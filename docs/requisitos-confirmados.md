# CEICOM · Requisitos confirmados para esta entrega

Esta especificación actualiza los puntos de la propuesta histórica. La aplicación principal es Next.js, TypeScript, Prisma y PostgreSQL; Django se conserva como origen para exportación y comparación.

Actualización de personas y credenciales: [versión 0.3](actualizacion-0.3.md).

## Perfiles y permisos

- Administración: usuarios y expedientes de estudiantes, cuentas docentes, carreras, materias/partes, gestiones, módulos con fechas, matrículas, ofertas, asignaciones e inscripciones. Puede cambiar turnos con motivo, autorizar carga fuera de plazo por oferta y restringir/habilitar manualmente la consulta.
- Docente: únicamente sus ofertas y sus estudiantes inscritos. El panel permite filtrar por carrera. Registra borradores y publica notas dentro de plazo o con autorización vigente.
- Estudiante: únicamente sus propias notas publicadas, con filtros de gestión y módulo y siempre que la consulta esté habilitada.

## Organización académica

Las carreras tienen tres años, representados por niveles 1, 2 y 3. Hay cuatro módulos de tres meses por gestión. Administración registra fechas de inicio y fin correspondientes al calendario institucional; no se generan períodos ni inscripciones automáticamente. Por ejemplo, un calendario enero–diciembre puede usar enero–marzo, abril–junio, julio–septiembre y octubre–diciembre. Las fechas efectivas deben cargarse conforme al calendario aprobado.

Las partes de una materia se registran por separado y se ofertan en sus módulos correspondientes. Cada parte tiene su propia inscripción y su propia nota: aprobar una parte no aprueba la otra, y nunca se calcula un promedio entre partes. La escala es 1–100; cada parte aprueba desde 61. El campo vacío indica pendiente.

La gestión de ingreso pertenece al expediente del estudiante; las gestiones cursadas pertenecen a sus matrículas anuales. Un traslado no reescribe la gestión de ingreso ni las matrículas de otras gestiones. Las notas publicadas y su turno histórico se conservan; las inscripciones sin publicar, incluidos sus borradores, se mueven solo si existen todas las ofertas compatibles. Si falta alguna, se revierte todo el traslado.

## Carga de notas

Se permiten tres días completos posteriores al fin del módulo, excluyendo sábados y domingos. El cierre del servidor es exclusivo a las 00:00 de Bolivia al comenzar el día siguiente al tercer día hábil. Una reapertura se limita a la oferta autorizada y tiene motivo, administrador responsable y vencimiento. Una nota publicada solo se corrige por administración con motivo; la auditoría conserva el valor anterior, el nuevo, autor y fecha.

## Mensualidades

La restricción es manual. No calcula deudas ni consulta un sistema de cobros. El estudiante conserva su cuenta y ve el aviso de mensualidades pendientes; no recibe sus notas mientras la consulta esté restringida. Las notas y el historial permanecen intactos, y el docente puede seguir registrando resultados.

## Identidad visual

Guindo, crema, gris y negro. El logo se integra en el login y en la navegación mediante public/brand/ceicom-logo.png. Es una adaptación digital de la imagen de referencia, no el archivo maestro vectorial del Instituto. Puede reemplazarse por el arte oficial en esa misma ruta sin modificar el código.

## Decisiones todavía pendientes

- Confirmar si se mantienen dos decimales y definir redondeo, recuperación y ponderaciones si se necesitan. La implementación admite hasta dos decimales y no redondea automáticamente.
- Definir feriados: actualmente solo se omiten sábados y domingos.
- Confirmar institucionalmente la hora de corte y la zona de Bolivia usadas por la versión actual.
- Confirmar responsable definitivo de publicación. Esta entrega permite publicar al docente asignado.
- Definir prerrequisitos de Parte II, recuperación de partes reprobadas y plan de estudios completo.
- Proporcionar el formato institucional para PDF/planilla impresa y, si procede, el archivo maestro del logo.
- Completar despliegue HTTPS, copias y restauración probada antes de introducir datos reales.

No están incluidos integración de cobros, recuperación automática por correo ni PDF institucional. Ver migracion-nextjs.md para la importación y puesta en marcha.
