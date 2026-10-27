from datetime import datetime, time, timedelta
from decimal import Decimal
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from django.utils import timezone

SHIFTS = [('M', 'Mañana'), ('T', 'Tarde'), ('N', 'Noche')]

def deadline_for(end_date):
    day = end_date
    counted = 0
    while counted < 3:
        day += timedelta(days=1)
        if day.weekday() < 5:
            counted += 1
    # Provisional: se permite todo el tercer día; feriados no se excluyen.
    return timezone.make_aware(datetime.combine(day + timedelta(days=1), time.min))

class Career(models.Model):
    name = models.CharField('nombre', max_length=150, unique=True)
    class Meta:
        verbose_name = 'carrera'
    def __str__(self): return self.name

class AcademicYear(models.Model):
    year = models.PositiveIntegerField('gestión', unique=True, validators=[MinValueValidator(2000), MaxValueValidator(2200)])
    class Meta:
        verbose_name = 'gestión'
        verbose_name_plural = 'gestiones'
        ordering = ['-year']
    def __str__(self): return str(self.year)

class Module(models.Model):
    year = models.ForeignKey(AcademicYear, on_delete=models.PROTECT, verbose_name='gestión')
    number = models.PositiveSmallIntegerField('módulo', validators=[MinValueValidator(1), MaxValueValidator(4)])
    starts = models.DateField('inicio')
    ends = models.DateField('fin')
    class Meta:
        verbose_name = 'módulo'
        constraints = [models.UniqueConstraint(fields=['year','number'], name='unique_module'), models.CheckConstraint(condition=models.Q(ends__gte=models.F('starts')), name='module_date_order')]
        ordering = ['year', 'number']
    def clean(self):
        if self.starts and self.ends:
            if self.ends < self.starts: raise ValidationError('El fin no puede ser anterior al inicio.')
            if self.year_id and (self.starts.year != self.year.year or self.ends.year != self.year.year):
                raise ValidationError('Las fechas deben pertenecer a la gestión elegida.')
    @property
    def deadline(self): return deadline_for(self.ends)
    def __str__(self): return f'{self.year} · Módulo {self.number}'

class Subject(models.Model):
    career = models.ForeignKey(Career, on_delete=models.PROTECT, verbose_name='carrera')
    name = models.CharField('materia', max_length=150)
    level = models.PositiveSmallIntegerField('año de carrera', validators=[MinValueValidator(1), MaxValueValidator(3)])
    part = models.PositiveSmallIntegerField('parte', default=1, validators=[MinValueValidator(1), MaxValueValidator(2)])
    class Meta:
        verbose_name = 'materia / parte'
        verbose_name_plural = 'materias / partes'
        constraints = [models.UniqueConstraint(fields=['career','name','part'], name='unique_subject_part')]
    def __str__(self): return f'{self.name} · Parte {self.part} · {self.career}'

class Student(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, verbose_name='usuario')
    code = models.CharField('código', max_length=30, unique=True)
    entry_year = models.PositiveIntegerField('gestión de ingreso')
    can_view_grades = models.BooleanField('consulta de notas habilitada', default=True)
    class Meta:
        verbose_name = 'estudiante'
    def __str__(self): return f'{self.code} · {self.user.get_full_name() or self.user.username}'

class Enrollment(models.Model):
    student = models.ForeignKey(Student, on_delete=models.PROTECT, verbose_name='estudiante')
    year = models.ForeignKey(AcademicYear, on_delete=models.PROTECT, verbose_name='gestión')
    career = models.ForeignKey(Career, on_delete=models.PROTECT, verbose_name='carrera')
    level = models.PositiveSmallIntegerField('año de carrera', validators=[MinValueValidator(1), MaxValueValidator(3)])
    shift = models.CharField('turno', max_length=1, choices=SHIFTS)
    class Meta:
        verbose_name = 'matrícula anual'
        verbose_name_plural = 'matrículas anuales'
        constraints = [models.UniqueConstraint(fields=['student','year','career'], name='unique_enrollment')]
    def __str__(self): return f'{self.student} · {self.year} · {self.get_shift_display()}'

class Offering(models.Model):
    subject = models.ForeignKey(Subject, on_delete=models.PROTECT, verbose_name='materia / parte')
    module = models.ForeignKey(Module, on_delete=models.PROTECT, verbose_name='módulo')
    teacher = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='teaching', verbose_name='docente')
    shift = models.CharField('turno', max_length=1, choices=SHIFTS)
    class Meta:
        verbose_name = 'asignación docente / oferta'
        verbose_name_plural = 'asignaciones docentes / ofertas'
        constraints = [models.UniqueConstraint(fields=['subject','module','shift'], name='unique_offering')]
    def __str__(self): return f'{self.subject} · {self.module} · {self.get_shift_display()}'
    def can_edit(self, user, now=None):
        now = now or timezone.now()
        if user.is_superuser: return True
        if self.teacher_id != user.pk: return False
        return now < self.module.deadline or self.extensions.filter(until__gt=now).exists()

class Registration(models.Model):
    enrollment = models.ForeignKey(Enrollment, on_delete=models.PROTECT, verbose_name='matrícula')
    offering = models.ForeignKey(Offering, on_delete=models.PROTECT, verbose_name='oferta')
    grade = models.DecimalField('nota', max_digits=5, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(100)])
    published = models.BooleanField('publicada', default=False)
    class Meta:
        verbose_name = 'inscripción y nota'
        verbose_name_plural = 'inscripciones y notas'
        constraints = [models.UniqueConstraint(fields=['enrollment','offering'], name='unique_registration'), models.CheckConstraint(condition=models.Q(grade__isnull=True) | models.Q(grade__gte=1, grade__lte=100), name='valid_grade'), models.CheckConstraint(condition=models.Q(published=False) | models.Q(grade__isnull=False), name='published_has_grade')]
    def clean(self):
        if self.enrollment_id and self.offering_id:
            e, o = self.enrollment, self.offering
            if e.year_id != o.module.year_id or e.career_id != o.subject.career_id or e.level != o.subject.level:
                raise ValidationError('La materia debe coincidir con gestión, carrera y año de la matrícula.')
            if e.shift != o.shift and not self.pk:
                raise ValidationError('El turno debe coincidir al inscribir. Usa el traslado para cambios posteriores.')
        if self.published and self.grade is None: raise ValidationError('No se puede publicar una nota vacía.')
    @property
    def result(self):
        return 'Pendiente' if self.grade is None else ('Aprobado' if self.grade >= Decimal('61') else 'Reprobado')
    def __str__(self): return f'{self.enrollment.student} · {self.offering.subject}'

class Extension(models.Model):
    offering = models.ForeignKey(Offering, on_delete=models.PROTECT, related_name='extensions', verbose_name='oferta autorizada')
    until = models.DateTimeField('habilitada hasta')
    reason = models.TextField('motivo')
    authorized_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        verbose_name = 'autorización excepcional'
        verbose_name_plural = 'autorizaciones excepcionales'
    def clean(self):
        if self.until and self.until <= timezone.now(): raise ValidationError('El vencimiento debe estar en el futuro.')
    def __str__(self): return f'{self.offering} · hasta {self.until}'

class AuditEvent(models.Model):
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    action = models.CharField(max_length=100)
    details = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        verbose_name = 'evento de auditoría'
        verbose_name_plural = 'eventos de auditoría'
        ordering = ['-created_at']
