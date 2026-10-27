from datetime import date, timedelta
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from academics.models import Career, AcademicYear, Module, Subject, Student, Enrollment, Offering, Registration

class Command(BaseCommand):
    help = 'Crea datos ficticios y cuentas de demostración; nunca usar con datos reales.'
    def add_arguments(self, parser):
        parser.add_argument('--confirm-demo', action='store_true')
    @transaction.atomic
    def handle(self, *args, **options):
        if not options['confirm_demo']: raise CommandError('Requiere --confirm-demo. Solo para una base de desarrollo vacía.')
        User = get_user_model()
        if User.objects.filter(username='admin_demo').exists():
            self.stdout.write('La demostración ya existe. No se cambiaron contraseñas, notas ni fechas.')
            return
        if User.objects.exists() or Career.objects.exists():
            raise CommandError('La base ya contiene datos. No se mezclará la demostración con datos existentes.')
        password = 'CeicomDemo2026!'
        admin = User.objects.create_superuser('admin_demo', password=password, first_name='Administración', last_name='CEICOM')
        teacher = User.objects.create_user('docente_demo', password=password, first_name='Carlos', last_name='Rojas')
        user = User.objects.create_user('estudiante_demo', password=password, first_name='Ana', last_name='López Vargas')
        today = timezone.localdate()
        year = AcademicYear.objects.create(year=today.year)
        career = Career.objects.create(name='Sistemas Informáticos')
        Career.objects.create(name='Contaduría General')
        student = Student.objects.create(user=user, code='CEI-DEMO-001', entry_year=today.year-2)
        enrollment = Enrollment.objects.create(student=student,year=year,career=career,level=3,shift='M')
        past = Module.objects.create(year=year,number=1,starts=date(today.year,1,1),ends=date(today.year,3,31))
        current = Module.objects.create(year=year,number=4,starts=date(today.year,10,1),ends=date(today.year,12,31))
        first = Subject.objects.create(career=career,name='Programación III',level=3,part=1)
        second = Subject.objects.create(career=career,name='Programación III',level=3,part=2)
        previous = Offering.objects.create(subject=first,module=past,teacher=teacher,shift='M')
        active = Offering.objects.create(subject=second,module=current,teacher=teacher,shift='M')
        Offering.objects.create(subject=second,module=current,teacher=teacher,shift='N')
        Registration.objects.create(enrollment=enrollment,offering=previous,grade=78,published=True)
        Registration.objects.create(enrollment=enrollment,offering=active)
        self.stdout.write(self.style.SUCCESS('Demostración creada. Usuarios: admin_demo, docente_demo, estudiante_demo. Contraseña de demostración: CeicomDemo2026! Cambia o elimina estas cuentas antes de usar datos reales.'))
