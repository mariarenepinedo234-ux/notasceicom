# Versión 0.1 · Evaluación funcional

La aplicación real está en `ceicom/`, `academics/`, `templates/` y `static/`. La maqueta `prototipo/` se conserva como antecedente y ya no es la aplicación principal.

Implementado: autenticación con sesiones y CSRF, separación de consultas por usuario, catálogos, matrículas, asignaciones, inscripciones, notas, publicación, cierre y extensión excepcional, traslado de turno, consulta restringida, exportación CSV y auditoría.

Las materias se identifican por carrera, nombre y parte, con año de carrera de 1 a 3. Cada parte tiene un resultado independiente y no se promedia con la otra. La gestión de ingreso pertenece al estudiante y se conserva al matricularlo en gestiones posteriores.

Las fechas límite se calculan en el servidor. La reapertura se limita a la oferta autorizada y su vencimiento. Los resultados publicados quedan inmovilizados para el docente; administración los corrige en la planilla con motivo, registrando ambos valores.

Decisiones provisionales: cierre al final del tercer día, zona horaria de Bolivia, feriados no excluidos, dos decimales y publicación directa por el docente. Confirmar antes de uso institucional.

Validación: 15 pruebas de Django cubren autenticación/CSRF, permisos por oferta, páginas y catálogos, borradores, publicación, notas inválidas, corrección, cierre exacto y vencimiento de autorizaciones, consulta propia/restringida, traslados completos y fallidos, CSV y calendario. No se ha validado despliegue público ni restauración en otra máquina.
