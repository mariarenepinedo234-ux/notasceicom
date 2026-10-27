# Migración Django → Next.js

## Correspondencia funcional

| Django | Next.js / Prisma |
|---|---|
| Inicio y prioridades administrador → estudiante → docente | `src/app/page.tsx` |
| Usuarios / contraseñas y permisos | `src/lib/auth.ts`, `password.ts`, `catalog.ts` |
| Modelos académicos y restricciones | `prisma/schema.prisma`, migración SQL, `catalog.ts` |
| Planilla, borrador y publicación | `src/app/materia/[id]`, `src/lib/academic.ts` |
| Tres días hábiles posteriores al módulo | `deadlineFor` en `src/lib/rules.ts` |
| Reapertura por oferta | Catálogo `/admin/extensions` |
| Corrección publicada con motivo | `saveGrades`, solo administrador |
| Traslado de borradores sin modificar historial | `transferEnrollment`, transacción serializable |
| Restricción manual de consulta | `/consulta/[id]`, `setVisibility` |
| Consulta propia por gestión y módulo | `studentResults` |
| CSV protegido contra fórmulas | `/planilla/[id]` |
| Catálogos y restablecimiento de contraseña | `/admin` |
| Auditoría de solo lectura | `/admin/auditoria` |
| Demostración idempotente | `scripts/seed.ts` |

Se mantienen las rutas principales `/login`, `/password`, `/materia/:id`, `/consulta/:id`, `/traslado/:id` y `/planilla/:id`; Next.js acepta las variantes con barra final mediante redirección. El catálogo Django se sustituye por el nuevo catálogo `/admin`; los enlaces internos antiguos `/admin/academics/...` no son las nuevas rutas.

Las decisiones provisionales del sistema original se mantienen: notas 1–100 con dos decimales como máximo, aprobación por parte desde 61, sin promediar partes; tres días hábiles completos omitiendo solo fines de semana; publicación por docente asignado; turnos M/T/N; sin feriados, PDF, recuperación por correo, cobros ni prerrequisitos nuevos.

El cierre exclusivo es las 00:00 de Bolivia al comenzar el día posterior al tercer día hábil. Se usa la fecha civil de PostgreSQL y UTC−04, correspondiente a America/La_Paz. La autorización excepcional también tiene vencimiento exclusivo.

## Preparación y exportación

1. Haz una copia verificada de la base Django y ensaya la restauración.
2. En una copia del origen, ejecuta los tests Django y verifica el inventario de registros y hashes. El importador soporta PBKDF2-SHA256 (predeterminado de Django 5.2), PBKDF2-SHA1 y contraseñas inutilizables. Cualquier otro algoritmo exige añadir y probar su verificador antes del traslado; el importador se detiene sin importar parcialmente.
3. Prepara PostgreSQL vacío, instala la aplicación y ejecuta las migraciones Prisma.
4. Pon Django en mantenimiento para impedir cambios posteriores a la exportación final.
5. Exporta desde el entorno Django original:

```sh
python manage.py dumpdata auth.user academics --all --indent 2 --output django-export.json
```

No uses `--natural-foreign` ni `--natural-primary`: el importador conserva las claves numéricas. No exportes sesiones, permisos de grupos ni content types; la autorización de esta aplicación depende de superusuario, perfil de estudiante y asignación docente. Los grupos Django no se usan en los flujos académicos del origen. Las sesiones se crean de nuevo al iniciar sesión.

El archivo incluye hashes y datos personales: consérvalo fuera de Git y limítalo a quienes realizan la migración.

## Importación y verificación

Desde la raíz Next.js, con DATABASE_URL apuntando al destino nuevo:

```sh
npm run db:migrate
npm run db:import-django -- /ruta/segura/django-export.json --confirm-empty-target
```

La importación exige destino vacío, rechaza modelos desconocidos y duplicados, usa una única transacción y un bloqueo de importación, conserva IDs, decimales, turnos, publicación, restricciones, autorizaciones y eventos históricos; valida coherencia de gestión/carrera/nivel, compara recuentos por modelo y reajusta las secuencias. No escribe ni borra nada en el origen. Las contraseñas compatibles se conservan literalmente. Un fallo revierte todos los registros del destino.

Antes de abrir a usuarios, compara recuentos mostrados con el origen y revisa expedientes representativos: estudiante restringido, nota publicada decimal, borrador, historial de traslado con turno antiguo, autorización vencida y auditoría. Prueba acceso con las tres clases de usuario y descarga CSV. Los tests de integración cubren importación, rollback y continuación de secuencias; los de navegador cubren acceso, publicación, restricción y catálogos. No sustituyen verificar la copia institucional.

## Puesta en marcha y vuelta atrás

Configura HTTPS, conexión PostgreSQL privada, copias periódicas con restauración probada y supervisión de errores. En producción las cookies son Secure y HttpOnly; todas las mutaciones de interfaz son Server Actions con verificación de origen de Next.js. Configura el proxy para conservar correctamente Host/Origin y no habilites orígenes ajenos. No expongas PostgreSQL a Internet.

La nueva versión añade sesiones persistidas con revocación por cambio de contraseña/rol, límite de intentos de acceso por usuario y control de versiones para planillas. Los cambios académicos se ejecutan con aislamiento serializable; si hay un conflicto se pide recargar. La auditoría es de aplicación y no es un registro externo inmutable.

La conservación de catálogos evita borrados. La matrícula y el expediente son inmutables; el turno cambia solo mediante traslado, la nota solo por planilla y la visibilidad solo mediante la acción auditada. Se impide renumerar gestiones en uso o alterar claves de módulos/ofertas que desorganicen el historial.

Abre Next.js después de validar el destino; mantén el origen en modo mantenimiento y conserva su copia. Si falla antes de admitir escrituras nuevas, vuelve al servicio Django y a la copia original. Si Next.js ya recibió cambios, detén escrituras y concilia esos cambios antes de volver: no existe sincronización inversa automática.

## Verificaciones reproducibles

```sh
npm run typecheck
npm test
# Solo una base separada con nombre terminado en _test:
DATABASE_URL='postgresql://usuario:clave@localhost:5432/ceicom_test' CEICOM_TEST_DB=1 npm run db:migrate
DATABASE_URL='postgresql://usuario:clave@localhost:5432/ceicom_test' CEICOM_TEST_DB=1 npm run test:integration
npm run build
```

Las pruebas de integración vacían sus tablas; el guard rechaza cualquier DATABASE_URL cuyo nombre de base no termine en `_test` o sin `CEICOM_TEST_DB=1`. Nunca configures una base institucional con ese nombre para ejecutar pruebas. Para las pruebas de navegador usa también esa base aislada, carga la demostración, instala Chromium con `npx playwright install chromium` y ejecuta `npm run test:e2e`. El workflow GitHub crea su propio PostgreSQL desechable.

## Referencia visual

Se conservan los colores guindo y crema y se añade un identificador tipográfico inspirado en la imagen proporcionada. El archivo del logotipo original no está en el repositorio; el texto tipográfico no es una reproducción exacta del arte adjunto.
