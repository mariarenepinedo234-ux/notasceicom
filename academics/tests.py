from datetime import date, datetime, timedelta
from decimal import Decimal
from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.test import TestCase, Client
from django.utils import timezone
from .models import Career, AcademicYear, Module, Subject, Student, Enrollment, Offering, Registration, Extension, AuditEvent, deadline_for

class AcademicWorkflowTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        User = get_user_model()
        cls.admin = User.objects.create_superuser('admin', password='TestingCeicom!2026')
        cls.teacher = User.objects.create_user('teacher', password='TestingCeicom!2026')
        cls.other = User.objects.create_user('other', password='TestingCeicom!2026')
        cls.student_user = User.objects.create_user('student', password='TestingCeicom!2026',first_name='Ana')
        cls.student = Student.objects.create(user=cls.student_user, code='S001',entry_year=2024)
        cls.career = Career.objects.create(name='Sistemas')
        cls.year = AcademicYear.objects.create(year=timezone.localdate().year+1)
        cls.module = Module.objects.create(year=cls.year,number=1,starts=date(cls.year.year,1,1),ends=date(cls.year.year,3,31))
        cls.subject = Subject.objects.create(career=cls.career,name='Programación I',level=1,part=1)
        cls.enrollment = Enrollment.objects.create(student=cls.student,year=cls.year,career=cls.career,level=1,shift='M')
        cls.offering = Offering.objects.create(subject=cls.subject,module=cls.module,teacher=cls.teacher,shift='M')
        cls.destination = Offering.objects.create(subject=cls.subject,module=cls.module,teacher=cls.teacher,shift='N')
        cls.row = Registration.objects.create(enrollment=cls.enrollment,offering=cls.offering)

    def data(self, grade='61', publish=True, reason=''):
        data = {f'grade_{self.row.pk}':grade,'reason':reason}
        if publish: data[f'publish_{self.row.pk}'] = 'on'
        return data

    def test_login_required_and_csrf(self):
        self.assertEqual(self.client.get('/').status_code,302)
        client = Client(enforce_csrf_checks=True)
        client.force_login(self.teacher)
        self.assertEqual(client.post(f'/materia/{self.offering.pk}/',self.data()).status_code,403)

    def test_role_pages_and_catalogs_render(self):
        for user in [self.admin,self.teacher,self.student_user]:
            self.client.force_login(user)
            self.assertEqual(self.client.get('/').status_code,200)
        self.client.force_login(self.admin)
        for model in ['career','academicyear','module','subject','student','enrollment','offering','registration','extension','auditevent']:
            self.assertEqual(self.client.get(f'/admin/academics/{model}/').status_code,200)

    def test_unauthorized_cannot_read_write_or_export_an_offering(self):
        for user in [self.other,self.student_user]:
            self.client.force_login(user)
            self.assertEqual(self.client.get(f'/materia/{self.offering.pk}/').status_code,404)
            self.assertEqual(self.client.post(f'/materia/{self.offering.pk}/',self.data()).status_code,404)
            self.assertEqual(self.client.get(f'/planilla/{self.offering.pk}/').status_code,404)

    def test_teacher_saves_draft_and_publishes(self):
        self.client.force_login(self.teacher)
        self.assertEqual(self.client.post(f'/materia/{self.offering.pk}/',self.data(publish=False)).status_code,302)
        self.row.refresh_from_db()
        self.assertEqual(self.row.grade,Decimal('61'))
        self.assertFalse(self.row.published)
        self.assertEqual(self.client.post(f'/materia/{self.offering.pk}/',self.data()).status_code,302)
        self.row.refresh_from_db()
        self.assertTrue(self.row.published)
        self.assertEqual(AuditEvent.objects.filter(action='Registro de nota').count(),2)

    def test_invalid_grades_and_empty_publication_rejected_atomically(self):
        self.client.force_login(self.teacher)
        for value in ['0','101','nan','', '61.123']:
            response = self.client.post(f'/materia/{self.offering.pk}/',self.data(grade=value))
            self.assertEqual(response.status_code,200)
            self.row.refresh_from_db()
            self.assertIsNone(self.row.grade)

    def test_blank_draft_is_pending(self):
        self.client.force_login(self.teacher)
        self.client.post(f'/materia/{self.offering.pk}/',self.data(grade='',publish=False))
        self.row.refresh_from_db()
        self.assertEqual(self.row.result,'Pendiente')

    def test_published_note_requires_admin_reason(self):
        self.row.grade=78;self.row.published=True;self.row.save()
        self.client.force_login(self.teacher)
        self.client.post(f'/materia/{self.offering.pk}/',self.data(grade='99'))
        self.row.refresh_from_db();self.assertEqual(self.row.grade,78)
        self.client.force_login(self.admin)
        self.client.post(f'/materia/{self.offering.pk}/',self.data(grade='99'))
        self.row.refresh_from_db();self.assertEqual(self.row.grade,78)
        self.client.post(f'/materia/{self.offering.pk}/',self.data(grade='99',reason='Corrección de transcripción'))
        self.row.refresh_from_db();self.assertEqual(self.row.grade,99)
        self.assertIn('78',AuditEvent.objects.first().details)

    def test_deadline_at_exact_boundary_and_extension_expiry(self):
        limit = self.module.deadline
        self.assertTrue(self.offering.can_edit(self.teacher,limit-timedelta(seconds=1)))
        self.assertFalse(self.offering.can_edit(self.teacher,limit))
        extension = Extension.objects.create(offering=self.offering,until=limit+timedelta(hours=1),reason='Autorizado',authorized_by=self.admin)
        self.assertTrue(self.offering.can_edit(self.teacher,limit))
        self.assertFalse(self.offering.can_edit(self.teacher,extension.until))
        self.assertFalse(self.offering.can_edit(self.other,limit))

    def test_expired_post_blocked_server_side_then_authorized(self):
        after = self.module.deadline+timedelta(seconds=1)
        with patch('academics.models.timezone.now',return_value=after):
            self.client.force_login(self.teacher)
            self.assertEqual(self.client.post(f'/materia/{self.offering.pk}/',self.data()).status_code,403)
            self.row.refresh_from_db();self.assertIsNone(self.row.grade)
            Extension.objects.create(offering=self.offering,until=after+timedelta(hours=1),reason='Excepción',authorized_by=self.admin)
            self.assertEqual(self.client.post(f'/materia/{self.offering.pk}/',self.data()).status_code,302)

    def test_student_sees_only_own_published_results(self):
        self.row.grade=61;self.row.published=True;self.row.save()
        self.client.force_login(self.student_user)
        response = self.client.get('/')
        self.assertContains(response,'Aprobado')
        self.assertEqual(list(response.context['rows']),[self.row])
        self.row.published=False;self.row.save()
        self.assertEqual(list(self.client.get('/').context['rows']),[])

    def test_visibility_restriction_and_audited_reenable(self):
        self.client.force_login(self.admin)
        self.client.post(f'/consulta/{self.student.pk}/',{'reason':'Revisión de mensualidades'})
        self.client.force_login(self.student_user)
        response=self.client.get('/')
        self.assertContains(response,'temporalmente suspendida')
        self.assertEqual(list(response.context['rows']),[])
        self.assertEqual(self.client.post(f'/consulta/{self.student.pk}/',{'reason':'Intento'}).status_code,403)
        self.client.force_login(self.admin)
        self.client.post(f'/consulta/{self.student.pk}/',{'reason':'Regularización confirmada'})
        self.student.refresh_from_db();self.assertTrue(self.student.can_view_grades)
        self.assertEqual(AuditEvent.objects.filter(action='Consulta de notas').count(),2)

    def test_transfer_preserves_published_history_and_draft_grade(self):
        part2=Subject.objects.create(career=self.career,name='Programación I',level=1,part=2)
        old=Offering.objects.create(subject=part2,module=self.module,teacher=self.teacher,shift='M')
        history=Registration.objects.create(enrollment=self.enrollment,offering=old,grade=60,published=True)
        self.row.grade=61;self.row.save()
        self.client.force_login(self.admin)
        self.assertEqual(self.client.post(f'/traslado/{self.enrollment.pk}/',{'shift':'N','reason':'Solicitud del estudiante'}).status_code,302)
        self.row.refresh_from_db();history.refresh_from_db();self.enrollment.refresh_from_db()
        self.assertEqual(self.enrollment.shift,'N')
        self.assertEqual(self.row.offering,self.destination)
        self.assertEqual(self.row.grade,61)
        self.assertEqual(history.offering,old)
        self.assertEqual(history.grade,60)
        self.assertEqual(history.result,'Reprobado')

    def test_missing_destination_does_not_partially_transfer(self):
        self.destination.delete()
        self.client.force_login(self.admin)
        response=self.client.post(f'/traslado/{self.enrollment.pk}/',{'shift':'N','reason':'Solicitud'})
        self.assertContains(response,'Falta una oferta compatible')
        self.enrollment.refresh_from_db();self.row.refresh_from_db()
        self.assertEqual(self.enrollment.shift,'M')
        self.assertEqual(self.row.offering,self.offering)
        self.assertFalse(AuditEvent.objects.exists())

    def test_csv_protects_formula_cells(self):
        self.student.user.first_name='=MALICIOUS()';self.student.user.save()
        self.client.force_login(self.teacher)
        response=self.client.get(f'/planilla/{self.offering.pk}/')
        self.assertContains(response,"'=MALICIOUS()")

    def test_calendar_skips_weekends_and_rolls_year(self):
        self.assertEqual(timezone.localtime(deadline_for(date(2026,4,3))).date(),date(2026,4,9))
        self.assertEqual(timezone.localtime(deadline_for(date(2026,12,31))).date(),date(2027,1,6))
