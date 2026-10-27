# Actualización 0.3 · Personas, roles y primer acceso

## Cambios

- Fondo vino oscuro en el panel y login; tarjetas claras para facilitar la lectura.
- Accesos directos a Estudiantes, Docentes y Usuarios y roles.
- Registro único de estudiante: rol, carnet de identidad, nombres, apellidos, correo opcional, número de matrícula/código institucional y gestión de ingreso. Crea cuenta y expediente juntos.
- Registro de docente con rol visible, CI, nombres, apellidos y correo opcional, aunque todavía no tenga materias asignadas.
- Usuarios y roles permite elegir Estudiante, Docente o Administrador; los campos del estudiante aparecen cuando corresponden.
- Las ofertas solo permiten seleccionar docentes activos. Un cambio de rol no elimina expedientes ni asignaciones; se bloquean los cambios incompatibles para evitar perder el acceso al historial.
- Usuario y contraseña temporal de las cuentas nuevas de docentes y estudiantes: su CI. Escribir sin espacios y con letras en mayúsculas cuando haya complemento, por ejemplo 1234567-1A. Los ceros iniciales se conservan.
- El primer acceso obliga a cambiar la contraseña antes de consultar o registrar información. La nueva contraseña tiene al menos 10 caracteres y debe ser distinta del CI.
- Mi cuenta permite cambiar el nombre de usuario confirmando la contraseña actual. Conserva CI, rol, expediente y notas; las otras sesiones se cierran.
- La administración puede editar nombres y datos de personas conservando el identificador interno y la auditoría. Cambiar un CI no restablece automáticamente la contraseña ni cambia el usuario existente.

El número de matrícula/código identifica el expediente del estudiante. La matrícula anual de carrera, gestión, nivel y turno se registra aparte en Matrículas anuales. La gestión de ingreso no se sustituye por la gestión cursada.

## Actualizar sin perder datos

1. Detén el servidor con Ctrl+C y realiza una copia de seguridad de PostgreSQL.
2. Descomprime esta versión en otra carpeta. Conserva tu archivo .env y úsalo en la carpeta nueva, con la misma DATABASE_URL. No copies node_modules ni .next.
3. Desde la carpeta que contiene package.json ejecuta:

```sh
npm ci
npm run db:migrate
npm run dev
```

La migración es aditiva: incorpora CI, rol y la marca de cambio inicial de contraseña. Deduce Administrador por superusuario y Estudiante por expediente; las demás cuentas quedan como Docente. No borra ni cambia contraseñas, notas, matrículas o usuarios existentes, y no inventa CIs. Administración puede completar los CIs faltantes. Las cuentas antiguas siguen ingresando como antes; solo las cuentas nuevas de docente/estudiante se crean con CI como credencial temporal.

No ejecutes migrate reset ni borres tu base. No vuelvas a cargar demostración sobre datos existentes. Si estás instalando de cero, consulta LEEME-PRIMERO.txt.

Prisma Client se genera automáticamente al iniciar desarrollo y al aplicar migraciones. Para generarlo manualmente: npm run db:generate.

## Usuarios de demostración

Las tres cuentas demo anteriores conservan sus nombres y contraseña documentados. Esto permite probar la actualización sin cambiar accesos ya conocidos. Para probar el ingreso por CI, registra una persona nueva desde Estudiantes o Docentes.
