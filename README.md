# CEICOM · Registro académico · v0.1

Primera versión funcional de desarrollo: Django 5.2, Python 3.12 y SQLite. Incluye autenticación, permisos en servidor, persistencia y diseño adaptable en guindo y crema. La maqueta anterior se conserva en `prototipo/`.

## Instalar y ejecutar

Desde la raíz del proyecto (en este entorno: `/workspace/notasceicom`):

```sh
python -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python manage.py migrate --noinput
.venv/bin/python manage.py check
.venv/bin/python manage.py runserver 0.0.0.0:8080 --noreload
```

El servidor es para desarrollo. La base `db.sqlite3` conserva los datos entre reinicios y está excluida de Git. No borrarla para actualizar el sistema; las migraciones actualizan su estructura.

## Demostración con datos ficticios

En una base vacía, antes de iniciar el servidor:

```sh
.venv/bin/python manage.py seed_demo --confirm-demo
```

| Perfil | Usuario | Contraseña de demostración |
|---|---|---|
| Administrador | `admin_demo` | `CeicomDemo2026!` |
| Docente | `docente_demo` | `CeicomDemo2026!` |
| Estudiante | `estudiante_demo` | `CeicomDemo2026!` |

Son cuentas públicas para pruebas locales. No usarlas con información real ni exponerlas a Internet. El comando se puede repetir sin restablecer contraseñas o notas. Si ya existen datos ajenos a la demostración, rechaza la carga.

Para una base vacía sin demostración: `.venv/bin/python manage.py createsuperuser`. El administrador crea usuarios desde «Catálogos y usuarios». Solo el administrador lleva activados «superusuario» y «acceso al sitio administrativo». Para un estudiante, vincular su usuario a un perfil de estudiante. Para un docente, asignar su usuario a una oferta de materia. No necesitan permisos administrativos.

## Funciones disponibles

- Usuarios, carreras, gestiones, módulos con fechas, materias/partes de los tres años, matrículas, asignaciones e inscripciones.
- Docente: ve solo sus ofertas, guarda borradores y publica resultados. La publicación directa por el docente es provisional y debe confirmarse con secretaría.
- Notas de 1 a 100; cada parte aprueba desde 61. Vacío significa pendiente. Provisionalmente se admiten dos decimales, sin redondeo automático.
- Tres días completos posteriores al fin del módulo, omitiendo sábados y domingos. Provisionalmente se permite hasta el final del tercer día en `America/La_Paz`; el cierre mostrado es el instante exclusivo de las 00:00 del día siguiente. No se excluyen feriados. El servidor rechaza cargas vencidas incluso por solicitudes directas.
- Reaperturas por oferta, con motivo y vencimiento, desde «Autorizar carga de notas».
- Una nota publicada solo la corrige administración en su planilla, con motivo obligatorio. La auditoría conserva nota anterior, nueva, autor y fecha.
- Traslado desde el panel: conserva notas publicadas y sus turnos; mueve inscripciones no publicadas y sus borradores a ofertas compatibles de la misma materia, parte y módulo. Si falta alguna, rechaza todo el traslado. Las demás gestiones no se modifican.
- Consulta propia por gestión y módulo. Restricción manual con motivo y auditoría, sin integración con cobros ni eliminación de notas.
- Planilla CSV para administración y docente asignado. Todavía no es el formato impreso oficial ni un PDF.
- Cambio de contraseña autenticado; administración puede restablecer contraseñas en el catálogo de usuarios.

Orden de altas: usuarios → carreras y gestiones → módulos → materias/partes → estudiantes → matrículas → ofertas → inscripciones. Luego se registran notas desde «Abrir planilla».

## Verificación

```sh
.venv/bin/python manage.py test academics
.venv/bin/python manage.py check
node --test tests/academic-rules.test.mjs
```

Las pruebas de Django usan una base temporal separada; no borran los datos del sistema.

## Alcance y pendientes

Versión para evaluación local, sin despliegue público. Los turnos de esta versión están predefinidos como mañana, tarde y noche. Faltan logo, formato institucional/PDF, plan de estudios completo y reglas de recuperación/prerrequisitos. Confirmar decimales, hora de corte, feriados y responsable de publicación antes de uso institucional.

Para producción se requiere PostgreSQL, HTTPS, servidor de aplicación, archivos estáticos, protección contra intentos repetidos de acceso y copias con restauración probada. La recuperación automática por correo aún no está implementada. La auditoría es de aplicación, no un registro externo inmutable. No introducir datos reales hasta completar esa preparación.

Variables: `CEICOM_DEBUG` (predeterminado `1`), `CEICOM_SECRET_KEY`, `CEICOM_ALLOWED_HOSTS` (lista separada por comas), `CEICOM_TIME_ZONE` (predeterminado `America/La_Paz`). Con `CEICOM_DEBUG=0` es obligatorio proporcionar una clave secreta; no escribirla en Git. En desarrollo se genera `.local-secret`, excluido de Git. PostgreSQL aún requiere configuración adicional.

Ver [propuesta funcional](docs/propuesta.md) y [estado de la versión](docs/version-0.1.md).
