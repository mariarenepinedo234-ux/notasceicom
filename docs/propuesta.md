# Registro académico CEICOM

Estado: propuesta histórica de referencia. Para los requisitos vigentes de la entrega Next.js, ver [requisitos confirmados](requisitos-confirmados.md) y [migración](migracion-nextjs.md). Ya existe una primera aplicación Django con datos ficticios; ver README.md y docs/version-0.1.md para el alcance implementado. Todavía no está lista para uso institucional.

## Primera versión

- Administrador: gestionar usuarios, carreras, planes de estudio, materias, turnos, gestiones, módulos y matrículas; asignar docentes; autorizar aperturas excepcionales; controlar la consulta de notas.
- Docente: consultar únicamente sus asignaciones y estudiantes inscritos; registrar borradores y presentar notas por materia y módulo.
- Estudiante: consultar únicamente su expediente, por gestión y módulo, cuando tenga habilitada la consulta.
- Exportar la planilla institucional a PDF y una hoja de cálculo, una vez confirmado su formato. Esto elimina la transcripción manual de secretaría.

## Historial académico

El estudiante tiene una identidad única. La gestión de ingreso no cambia cuando comienza una nueva gestión académica. Carrera, nivel, turno y grupo pertenecen a la matrícula de cada gestión, no a un único campo que sobrescriba el pasado.

Cada resultado corresponde a una inscripción en una oferta concreta de materia, gestión y módulo. Cambiar de turno crea un movimiento con fecha, responsable y motivo. Conserva matrículas anteriores, materias aprobadas y notas; las inscripciones activas solo se trasladan a ofertas compatibles, evitando duplicados. Los cambios de carrera o de plan necesitan reglas separadas de equivalencia.

Entidades propuestas: usuario, perfil de estudiante, perfil de docente, carrera, plan de estudio, materia del plan, turno, gestión, módulo, matrícula anual, oferta de materia, asignación docente, inscripción en materia, evaluación, resultado, movimiento de turno, autorización excepcional y evento de auditoría.

Las carreras duran tres años. Algunas materias abarcan dos módulos: por ejemplo, Programación I tiene una Parte I en un módulo y una Parte II en el siguiente. El nombre «Programación I» es el de la materia; el número de la parte es un dato separado. Cada parte se relaciona con su materia y tiene una oferta y una nota propias. Cada parte se aprueba por separado con un mínimo de 61/100. No se promedian ni se compensan las notas entre partes: aprobar la Parte I no aprueba la Parte II. La regla de habilitación para cursar la Parte II todavía debe confirmarse. El plan de estudio indicará el año y orden de las partes.

## Registro y cierre de notas

Un módulo tiene inicio y fin. Antes de abrirlo se validan sus fechas y su pertenencia a una gestión. Se proponen cuatro módulos por gestión; falta confirmar si aplican igual a todas las carreras.

Estados propuestos: borrador, presentado y publicado. El estudiante consulta solo notas publicadas. Se debe confirmar si publicar corresponde al docente o al administrador.

La escala confirmada es de 1 a 100, con aprobación desde 61. Un campo vacío significa nota pendiente y no equivale a cero ni a reprobación. Falta confirmar si se admiten decimales y cómo se redondean; la maqueta los admite provisionalmente y no los redondea.

El plazo confirmado es de tres días completos excluyendo sábados y domingos, después del fin del módulo. Por ejemplo, si termina un viernes, se cuentan lunes, martes y miércoles. La maqueta incluye un calculador de la fecha del tercer día, sin bloqueo real. Falta confirmar la hora de corte, la zona horaria institucional y el tratamiento de feriados. No se asumen horas laborales ni se omiten feriados automáticamente. El cierre real se deberá aplicar en el servidor, incluso al enviar solicitudes directamente, mostrando al docente la fecha y hora límite.

La reapertura excepcional debe tener docente, oferta afectada, motivo, responsable y vencimiento. No abrir globalmente todas las notas. Toda corrección guarda valor anterior y nuevo, autor, fecha y motivo.

## Consulta restringida

La habilitación de consulta se maneja manualmente, sin integración con cobros ni cálculo de deuda. Se propone restringir solo las notas y mantener el acceso a la cuenta y al aviso: «Tu consulta de notas está temporalmente suspendida. Comunícate con administración para regularizar tus mensualidades».

No eliminar ni modificar resultados por esta restricción. El docente puede registrar notas del estudiante aunque este no pueda consultarlas. Registrar quién cambia la restricción, cuándo y por qué.

## Permisos y operación real

Validar permisos en el servidor para cada operación y expediente; ocultar botones no basta. Contraseñas cifradas mediante hash, sesiones seguras, recuperación de acceso, auditoría y copias de seguridad restaurables son parte de la implementación real. No usar datos personales reales en la maqueta.

Propuesta técnica para la aplicación real: Django y PostgreSQL, con interfaz adaptable a celular y computadora. La maqueta usa HTML, CSS y JavaScript sin dependencias para revisar pantallas antes de fijar reglas de evaluación.

## Preguntas pendientes

1. Componentes, ponderaciones, decimales, redondeo y recuperación.
2. Hora de corte, zona horaria institucional y feriados del plazo de tres días completos sin fines de semana.
3. Requisitos para cursar la Parte II y procedimiento de recuperación de una parte reprobada. La aprobación independiente de cada parte con 61 ya está confirmada.
4. Formato actual de la planilla, quién publica y quién puede corregir una nota publicada.
5. Cambios de turno entre gestiones o también durante un módulo; manejo de materias reprobadas y repetidas.

## Orden de implementación

1. Revisar maqueta y confirmar reglas académicas con una planilla de ejemplo anonimizada.
2. Autenticación y permisos; catálogos, matrículas e historial persistente.
3. Ofertas y asignaciones, evaluación, cierre y autorizaciones excepcionales.
4. Consulta del estudiante, restricción manual y exportación institucional.
5. Validar casos completos, seguridad de acceso, copias y restauración antes del uso real.
