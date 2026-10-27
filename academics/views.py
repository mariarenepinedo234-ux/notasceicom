import csv
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied
from django.db import transaction
from django.http import HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_http_methods
from .forms import GradebookForm, TransferForm, VisibilityForm
from .models import Student, Enrollment, Offering, Registration, AuditEvent

def require_admin(user):
    if not user.is_superuser: raise PermissionDenied

def accessible_offering(user, pk):
    qs = Offering.objects.select_related('subject__career','module__year','teacher')
    if not user.is_superuser: qs = qs.filter(teacher=user)
    return get_object_or_404(qs, pk=pk)

@login_required
def dashboard(request):
    if request.user.is_superuser:
        enrollments = Enrollment.objects.select_related('student__user','year','career').order_by('-year__year','student__code')
        return render(request, 'dashboard.html', {'mode':'admin','enrollments':enrollments, 'offerings':Offering.objects.select_related('subject','module__year','teacher'), 'students_count':Student.objects.count(), 'events':AuditEvent.objects.select_related('actor')[:10]})
    if hasattr(request.user, 'student'):
        student = request.user.student
        rows = Registration.objects.filter(enrollment__student=student, published=True).select_related('enrollment__year','offering__module','offering__subject__career').order_by('-enrollment__year__year','offering__module__number','offering__subject__name') if student.can_view_grades else Registration.objects.none()
        years = Enrollment.objects.filter(student=student).values_list('year__year',flat=True).distinct().order_by('-year__year')
        year, module = request.GET.get('year',''), request.GET.get('module','')
        if year:
            rows = rows.filter(enrollment__year__year=int(year)) if year.isdigit() and len(year) == 4 else rows.none()
        if module:
            rows = rows.filter(offering__module__number=int(module)) if module in ['1','2','3','4'] else rows.none()
        return render(request, 'dashboard.html', {'mode':'student','student':student,'rows':rows,'years':years,'selected_year':year,'selected_module':module,'modules':[1,2,3,4]})
    offerings = Offering.objects.filter(teacher=request.user).select_related('subject__career','module__year')
    return render(request, 'dashboard.html', {'mode':'teacher','offerings':offerings})

@login_required
@require_http_methods(['GET','POST'])
def gradebook(request, pk):
    offering = accessible_offering(request.user, pk)
    can_edit = offering.can_edit(request.user)
    with transaction.atomic():
        registrations = list(Registration.objects.select_for_update().filter(offering=offering).select_related('enrollment__student__user'))
        form = GradebookForm(request.POST if request.method == 'POST' else None, registrations=registrations, administrator=request.user.is_superuser)
        if request.method == 'POST':
            if not can_edit: raise PermissionDenied('El plazo terminó. Solicita una autorización de administración.')
            if form.is_valid():
                for row in registrations:
                    before = f'nota={row.grade}, publicada={row.published}'
                    grade, published = form.cleaned_data[f'grade_{row.pk}'], form.cleaned_data[f'publish_{row.pk}']
                    if (row.grade, row.published) != (grade, published):
                        row.grade, row.published = grade, published
                        row.full_clean()
                        row.save(update_fields=['grade','published'])
                        AuditEvent.objects.create(actor=request.user, action='Registro de nota', details=f'Inscripción {row.pk}: {before} → nota={grade}, publicada={published}. Motivo: {form.cleaned_data.get("reason", "")}')
                messages.success(request,'Notas guardadas. Solo las marcadas como publicadas son visibles al estudiante.')
                return redirect('gradebook', pk=pk)
        entries = [(row, form[f'grade_{row.pk}'], form[f'publish_{row.pk}']) for row in registrations]
    return render(request, 'gradebook.html', {'offering':offering, 'form':form, 'entries':entries, 'can_edit':can_edit})

@login_required
@require_http_methods(['GET','POST'])
def toggle_visibility(request, pk):
    require_admin(request.user)
    student = get_object_or_404(Student, pk=pk)
    form = VisibilityForm(request.POST if request.method == 'POST' else None)
    if request.method == 'POST' and form.is_valid():
        with transaction.atomic():
            student = Student.objects.select_for_update().get(pk=pk)
            student.can_view_grades = not student.can_view_grades
            student.save(update_fields=['can_view_grades'])
            AuditEvent.objects.create(actor=request.user, action='Consulta de notas', details=f'{student}: habilitada={student.can_view_grades}. {form.cleaned_data["reason"]}')
        messages.success(request,'Consulta actualizada; las notas se conservan intactas.')
        return redirect('dashboard')
    return render(request, 'form.html', {'title':f'Cambiar consulta · {student}', 'form':form, 'description':'Este cambio habilita o restringe únicamente la consulta de notas. No desactiva la cuenta.'})

@login_required
@require_http_methods(['GET','POST'])
def transfer(request, pk):
    require_admin(request.user)
    enrollment = get_object_or_404(Enrollment.objects.select_related('student__user','year'), pk=pk)
    form = TransferForm(request.POST if request.method == 'POST' else None, initial={'shift':enrollment.shift})
    if request.method == 'POST' and form.is_valid():
        with transaction.atomic():
            enrollment = Enrollment.objects.select_for_update().get(pk=pk)
            target = form.cleaned_data['shift']
            changes = []
            if target == enrollment.shift:
                form.add_error('shift','Elige un turno distinto al actual.')
            else:
                for row in Registration.objects.select_for_update().filter(enrollment=enrollment, published=False).select_related('offering'):
                    # Notas en borrador también se conservan al mover la inscripción.
                    destination = Offering.objects.filter(subject=row.offering.subject, module=row.offering.module, shift=target).first()
                    if not destination or Registration.objects.filter(enrollment=enrollment,offering=destination).exclude(pk=row.pk).exists():
                        form.add_error('shift',f'Falta una oferta compatible sin duplicados para {row.offering.subject}. Crea la oferta de destino primero.')
                        break
                    changes.append((row,destination))
            if not form.errors:
                previous = enrollment.get_shift_display()
                for row,destination in changes:
                    original = row.offering_id
                    row.offering = destination
                    row.save(update_fields=['offering'])
                    AuditEvent.objects.create(actor=request.user, action='Traslado de inscripción', details=f'Inscripción {row.pk}: oferta {original} → {destination.pk}. Nota conservada: {row.grade}. {form.cleaned_data["reason"]}')
                enrollment.shift = target
                enrollment.save(update_fields=['shift'])
                AuditEvent.objects.create(actor=request.user, action='Cambio de turno', details=f'Matrícula {enrollment.pk}: {previous} → {enrollment.get_shift_display()}. {form.cleaned_data["reason"]}')
                messages.success(request,'Traslado registrado. Las notas publicadas y sus turnos originales se conservaron.')
                return redirect('dashboard')
    return render(request,'form.html',{'title':f'Traslado · {enrollment}', 'form':form, 'description':'Las notas publicadas conservan el turno cursado. Las inscripciones sin publicar se trasladan solo si existe una oferta de destino de la misma materia, parte y módulo.'})

@login_required
def export_grades(request, pk):
    offering = accessible_offering(request.user, pk)
    response = HttpResponse(content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = f'attachment; filename="ceicom-planilla-{pk}.csv"'
    response.write('\ufeff')
    writer = csv.writer(response)
    writer.writerow(['Código','Estudiante','Carrera','Materia','Parte','Gestión','Módulo','Turno','Nota','Resultado','Publicada'])
    def safe(value):
        value = str(value)
        return "'" + value if value.startswith(('=','+','-','@','\t','\r','\n')) else value
    for row in Registration.objects.filter(offering=offering).select_related('enrollment__student__user'):
        student = row.enrollment.student
        writer.writerow([safe(student.code), safe(student.user.get_full_name() or student.user.username),safe(offering.subject.career),safe(offering.subject.name),offering.subject.part,offering.module.year.year,offering.module.number,offering.get_shift_display(),row.grade if row.grade is not None else '',row.result,'Sí' if row.published else 'No'])
    return response
