import { Prisma, PrismaClient } from "@prisma/client";
import { db } from "./db";
import { canEdit, DomainError, id, invariant, parseGrade, reason, shifts } from "./rules";
type Tx = Prisma.TransactionClient;
export type Actor = { id: number; isSuperuser: boolean };
export async function actorIn(tx: Tx, actorId: number, admin = false) {
  const actor = await tx.user.findUnique({ where: { id: id(actorId) } });
  invariant(actor?.isActive, "La cuenta no está habilitada.");
  invariant(!actor.mustChangePassword, "Primero cambia tu contraseña temporal.");
  invariant(!admin || actor.isSuperuser, "Acceso exclusivo de administración.");
  return actor;
}
export async function atomic<T>(fn: (tx: Tx) => Promise<T>, client: PrismaClient = db): Promise<T> {
  try {
    return await client.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2034") throw new DomainError("Hubo otro cambio simultáneo. Recarga la página e inténtalo otra vez.");
      if (error.code === "P2002") throw new DomainError("Ya existe un registro con esos datos.");
      if (error.code === "P2003") throw new DomainError("El registro relacionado no existe o está en uso.");
    }
    throw error;
  }
}
export async function audit(tx: Tx, actorId: number, action: string, details: string) {
  await tx.auditEvent.create({ data: { actorId, action, details } });
}
export async function accessibleOffering(actor: Actor, offeringId: number, client: Tx = db) {
  return client.offering.findFirst({ where: { id: id(offeringId), ...(actor.isSuperuser ? {} : { teacherId: actor.id }) },
    include: { subject: { include: { career: true } }, module: { include: { year: true } }, teacher: true, extensions: true } });
}
export type GradeInput = { id: number; version: number; grade: string; published: boolean };
export async function saveGrades(actorId: number, offeringId: number, input: GradeInput[], correctionReason: string,
  client = db, now = new Date()) {
  return atomic(async tx => {
    const actor = await actorIn(tx, actorId);
    const offering = await accessibleOffering(actor, offeringId, tx);
    invariant(offering, "No se encontró la oferta o no tienes acceso.");
    await tx.$queryRaw`SELECT "id" FROM "Offering" WHERE "id" = ${offering.id} FOR UPDATE`;
    invariant(canEdit(actor, offering, now), "El plazo terminó. Solicita una autorización de administración.");
    const rows = await tx.registration.findMany({ where: { offeringId: offering.id } });
    const known = new Set(rows.map(r => r.id));
    invariant(input.every(r => known.has(r.id)) && new Set(input.map(r => r.id)).size === input.length,
      "La planilla contiene inscripciones inválidas.");
    for (const row of rows) {
      // Una nota publicada es inmutable para el docente, incluso mediante una solicitud manual.
      if (row.published && !actor.isSuperuser) continue;
      const next = input.find(r => r.id === row.id);
      invariant(next && next.version === row.version, "La planilla cambió. Recarga antes de guardar.");
      const grade = parseGrade(next.grade);
      invariant(!next.published || grade !== null, "Ingresa una nota antes de publicarla.");
      if ((row.grade === null ? null : row.grade.toFixed(2)) === grade && row.published === next.published) continue;
      const why = row.published ? reason(correctionReason) : correctionReason.trim().slice(0, 4000);
      const changed = await tx.registration.updateMany({ where: { id: row.id, version: next.version, offeringId },
        data: { grade, published: next.published, version: { increment: 1 } } });
      invariant(changed.count === 1, "La planilla cambió. Recarga antes de guardar.");
      await audit(tx, actor.id, "Registro de nota",
        `Inscripción ${row.id}: nota=${row.grade}, publicada=${row.published} → nota=${grade}, publicada=${next.published}. Motivo: ${why}`);
    }
  }, client);
}
export async function transferEnrollment(actorId: number, enrollmentId: number, shift: string, why: string, client = db) {
  return atomic(async tx => {
    const actor = await actorIn(tx, actorId, true);
    invariant(Object.hasOwn(shifts, shift), "Turno inválido.");
    const detail = reason(why);
    await tx.$queryRaw`SELECT "id" FROM "Enrollment" WHERE "id" = ${id(enrollmentId)} FOR UPDATE`;
    const enrollment = await tx.enrollment.findUnique({ where: { id: enrollmentId } });
    invariant(enrollment, "Matrícula inexistente.");
    invariant(enrollment.shift !== shift, "Elige un turno distinto al actual.");
    const rows = await tx.registration.findMany({ where: { enrollmentId, published: false }, include: { offering: true } });
    const moves = [];
    for (const row of rows) {
      const destination = await tx.offering.findUnique({ where: { subjectId_moduleId_shift: {
        subjectId: row.offering.subjectId, moduleId: row.offering.moduleId, shift } } });
      invariant(destination, "Falta una oferta compatible. Crea todas las ofertas de destino primero.");
      invariant(!await tx.registration.findUnique({ where: { enrollmentId_offeringId: { enrollmentId, offeringId: destination.id } } }),
        "La oferta de destino ya contiene una inscripción para esta matrícula.");
      moves.push({ row, destination });
    }
    for (const { row, destination } of moves) {
      const changed = await tx.registration.updateMany({ where: { id: row.id, version: row.version, published: false },
        data: { offeringId: destination.id, version: { increment: 1 } } });
      invariant(changed.count === 1, "Las notas cambiaron durante el traslado. Vuelve a intentarlo.");
      await audit(tx, actor.id, "Traslado de inscripción",
        `Inscripción ${row.id}: oferta ${row.offeringId} → ${destination.id}. Nota conservada: ${row.grade}. ${detail}`);
    }
    await tx.enrollment.update({ where: { id: enrollmentId }, data: { shift } });
    await audit(tx, actor.id, "Cambio de turno", `Matrícula ${enrollmentId}: ${enrollment.shift} → ${shift}. ${detail}`);
  }, client);
}
export async function setVisibility(actorId: number, studentId: number, enabled: boolean, why: string, client = db) {
  return atomic(async tx => {
    const actor = await actorIn(tx, actorId, true);
    const detail = reason(why);
    const student = await tx.student.findUnique({ where: { id: id(studentId) } });
    invariant(student, "Estudiante inexistente.");
    if (student.canViewGrades === enabled) return;
    await tx.student.update({ where: { id: studentId }, data: { canViewGrades: enabled } });
    await audit(tx, actor.id, "Consulta de notas", `Estudiante ${student.code}: habilitada=${enabled}. ${detail}`);
  }, client);
}
export async function studentResults(actorId: number, year?: string, module?: string, client = db) {
  const actor = await client.user.findUnique({ where: { id: actorId }, include: { student: true } });
  invariant(actor?.isActive && !actor.mustChangePassword && actor.student, "No existe un perfil de estudiante habilitado.");
  if (!actor.student.canViewGrades) return [];
  if ((year && !/^\d{4}$/.test(year)) || (module && !/^[1-4]$/.test(module))) return [];
  return client.registration.findMany({ where: {
    published: true, enrollment: { studentId: actor.student.id, ...(year ? { year: { year: Number(year) } } : {}) },
    ...(module ? { offering: { module: { number: Number(module) } } } : {}),
  }, include: { enrollment: { include: { year: true } },
    offering: { include: { subject: { include: { career: true } }, module: true } } },
    orderBy: [{ enrollment: { year: { year: "desc" } } }, { offering: { module: { number: "asc" } } },
      { offering: { subject: { name: "asc" } } }] });
}
