# CEICOM · Registro académico · Next.js

Migración de Django a **Next.js App Router, TypeScript, Prisma y PostgreSQL**. Incluye los portales de administración, docentes y estudiantes y los flujos académicos de la versión Django: catálogos, matrículas, ofertas, inscripciones, notas, publicación, reaperturas, correcciones, traslado, consulta restringida, CSV y auditoría.

El código Django se conserva para exportar los datos y facilitar la comparación. La aplicación principal de esta rama se ejecuta con Node.js.

## Instalar

Requisitos: Node.js 22.14 o posterior y PostgreSQL 17.

```sh
cp .env.example .env
# Ajusta DATABASE_URL antes de continuar.
npm install
npm run db:migrate
```

PostgreSQL local opcional con Docker:

```sh
POSTGRES_PASSWORD=ceicom_local docker compose up -d postgres
```

La URL de ejemplo de .env corresponde a esta contraseña exclusivamente local. Usa otra contraseña en cualquier despliegue real y actualiza DATABASE_URL. El volumen conserva PostgreSQL entre reinicios.

Crear el administrador inicial en una instalación sin datos importados:

```sh
CEICOM_ADMIN_USER=administracion CEICOM_ADMIN_PASSWORD='elige-una-clave-unica-y-larga' npm run admin:create
npm run dev
```

Abre http://localhost:3000. Para producción:

```sh
npm run build
npm start
```

El servicio debe estar detrás de HTTPS en producción, donde las cookies de sesión son Secure. No uses datos reales hasta verificar permisos, copias de seguridad y restauración.

## Conservar los datos de Django

No es necesario restablecer las contraseñas PBKDF2 predeterminadas de Django. Conserva el origen, exporta desde su entorno Python e importa a una base PostgreSQL vacía:

```sh
python manage.py dumpdata auth.user academics --all --indent 2 --output django-export.json
# Desde la instalación Next.js:
npm run db:import-django -- /ruta/segura/django-export.json --confirm-empty-target
```

El importador valida y conserva IDs, contraseñas compatibles, notas, publicación, matrículas, turnos históricos, restricciones, autorizaciones y auditoría. Verifica recuentos y restablece secuencias. Un error revierte toda la importación. No mezcles una demostración con datos migrados.

Lee el [procedimiento completo y correspondencia funcional](docs/migracion-nextjs.md) antes de trasladar datos institucionales.

## Demostración local

En una base vacía:

```sh
npm run db:seed -- --confirm-demo
```

Usuarios: `admin_demo`, `docente_demo`, `estudiante_demo`. Contraseña pública de prueba: `CeicomDemo2026!`. La carga es idempotente y no restablece notas ni contraseñas; rechaza datos ajenos a la demostración. No expongas estas cuentas con datos reales.

## Uso

- Administración: crea usuarios → carreras y gestiones → módulos → materias/partes → estudiantes → matrículas → ofertas → inscripciones.
- Docente: abre sus planillas, guarda borradores y publica resultados. Solo puede editar en plazo o con autorización; las notas publicadas se corrigen por administración con motivo.
- Estudiante: consulta únicamente sus resultados publicados y habilitados, filtrados por gestión y módulo.
- Administración: autoriza reaperturas por oferta, registra traslados de turno y restringe/habilita consulta con motivo. La auditoría conserva los cambios.

Notas de 1 a 100, máximo dos decimales, sin redondeo automático y aprobación desde 61 por parte. Los tres días hábiles posteriores al módulo excluyen sábados y domingos y permiten todo el tercer día en America/La_Paz. Feriados, publicación institucional definitiva, PDF, cobros, recuperación por correo y reglas de recuperación/prerrequisitos conservan el alcance pendiente de Django.

## Verificar

```sh
npm run typecheck
npm test
npm run build
```

Las pruebas PostgreSQL requieren una base separada con nombre terminado en `_test` y `CEICOM_TEST_DB=1`; vacían únicamente esa base de prueba. Ver [instrucciones completas](docs/migracion-nextjs.md#verificaciones-reproducibles). El workflow `.github/workflows/nextjs.yml` ejecuta tipos, pruebas unitarias, integración PostgreSQL, compilación y pruebas de navegador en un servicio aislado.

Variables: `DATABASE_URL`. Las variables `CEICOM_ADMIN_USER` y `CEICOM_ADMIN_PASSWORD` se usan solo para crear un administrador desde consola; no son necesarias para iniciar el servicio. No guardes secretos en Git.

Referencia anterior: [propuesta funcional](docs/propuesta.md) y [versión Django 0.1](docs/version-0.1.md).
