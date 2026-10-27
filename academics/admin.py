from django.contrib import admin
from .models import Career, AcademicYear, Module, Subject, Student, Enrollment, Offering, Registration, Extension, AuditEvent

class InstitutionAdmin(admin.ModelAdmin):
    def has_module_permission(self, request): return request.user.is_superuser
    def has_view_permission(self, request, obj=None): return request.user.is_superuser
    def has_add_permission(self, request): return request.user.is_superuser
    def has_change_permission(self, request, obj=None): return request.user.is_superuser
    def has_delete_permission(self, request, obj=None): return False
    def save_model(self, request, obj, form, change):
        super().save_model(request,obj,form,change)
        AuditEvent.objects.create(actor=request.user, action='Edición administrativa' if change else 'Alta administrativa', details=f'{obj._meta.verbose_name} #{obj.pk}: {obj}. Campos: {", ".join(form.changed_data)}')

@admin.register(Career, AcademicYear)
class CatalogAdmin(InstitutionAdmin): pass

@admin.register(Module)
class ModuleAdmin(InstitutionAdmin):
    list_display = ['year','number','starts','ends','deadline']

@admin.register(Subject)
class SubjectAdmin(InstitutionAdmin):
    list_display = ['name','part','career','level']
    list_filter = ['career','level','part']

@admin.register(Student)
class StudentAdmin(InstitutionAdmin):
    list_display = ['code','user','entry_year','can_view_grades']
    search_fields = ['code','user__first_name','user__last_name']
    def get_readonly_fields(self, request, obj=None):
        return ['can_view_grades','user','entry_year','code'] if obj else ['can_view_grades']

@admin.register(Enrollment)
class EnrollmentAdmin(InstitutionAdmin):
    list_display = ['student','year','career','level','shift']
    list_filter = ['year','career','shift']
    def get_readonly_fields(self, request, obj=None):
        return ['student','year','career','level','shift'] if obj else []

@admin.register(Offering)
class OfferingAdmin(InstitutionAdmin):
    list_display = ['subject','module','teacher','shift']
    list_filter = ['module','subject__career','shift']
    def get_readonly_fields(self, request, obj=None):
        return ['subject','module','shift'] if obj else []

@admin.register(Registration)
class RegistrationAdmin(InstitutionAdmin):
    list_display = ['enrollment','offering','grade','published']
    list_filter = ['offering__module','published']
    def get_readonly_fields(self, request, obj=None):
        return ['enrollment','offering','grade','published'] if obj else ['grade','published']

@admin.register(Extension)
class ExtensionAdmin(InstitutionAdmin):
    list_display = ['offering','until','authorized_by','reason']
    readonly_fields = ['authorized_by','created_at']
    def save_model(self, request, obj, form, change):
        obj.authorized_by = request.user
        super().save_model(request,obj,form,change)

@admin.register(AuditEvent)
class AuditAdmin(InstitutionAdmin):
    list_display = ['created_at','actor','action','details']
    readonly_fields = ['created_at','actor','action','details']
    def has_add_permission(self, request): return False
    def has_change_permission(self, request, obj=None): return False
