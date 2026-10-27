import { z } from "zod";
import { db } from "./db";
import { actorIn, atomic, audit } from "./academic";
import { dateOnly, id, invariant, reason } from "./rules";
import { hashPassword, validatePassword } from "./password";
const text = z.string().trim().min(1).max(150);
const pk = z.coerce.number().int().positive();
const level = z.coerce.number().int().min(1).max(3);
const shift = z.enum(["M", "T", "N"]);
export const catalogNames = {
  users: "Usuarios", careers: "Carreras", years: "Gestiones", modules: "Módulos",
  subjects: "Materias / partes", students: "Estudiantes", enrollments: "Matrículas",
  offerings: "Asignaciones / ofertas", registrations: "Inscripciones", extensions: "Autorizar carga de notas",
} as const;
export type Catalog = keyof typeof catalogNames;
export function isCatalog(s: string): s is Catalog { return Object.hasOwn(catalogNames, s); }
const schemas = {
  users: z.object({ username: z.string().trim().min(1).max(150).regex(/^[\w.@+\-]+$/),
    firstName: z.string().trim().max(150), lastName: z.string().trim().max(150),
    email: z.union([z.literal(""), z.email().max(254)]), isActive: z.boolean(), isSuperuser: z.boolean() }),
  careers: z.object({ name: text }),
  years: z.object({ year: z.coerce.number().int().min(2000).max(2200) }),
  modules: z.object({ yearId: pk, number: z.coerce.number().int().min(1).max(4), starts: z.string(), ends: z.string() }),
  subjects: z.object({ careerId: pk, name: text, level, part: z.coerce.number().int().min(1).max(2) }),
  students: z.object({ userId: pk, code: z.string().trim().min(1).max(30), entryYear: z.coerce.number().int().min(0).max(9999) }),
  enrollments: z.object({ studentId: pk, yearId: pk, careerId: pk, level, shift }),
  offerings: z.object({ subjectId: pk, moduleId: pk, teacherId: pk, shift }),
  registrations: z.object({ enrollmentId: pk, offeringId: pk }),
  extensions: z.object({ offeringId: pk, until: z.string(), reason: z.string() }),
};
export async function saveCatalog(actorId: number, kind: Catalog, recordId: number | null,
  raw: Record<string, unknown>, client = db) {
  return atomic(async tx => {
    const actor = await actorIn(tx, actorId, true);
    let savedId: number;
    switch (kind) {
      case "users": {
        const data = schemas.users.parse(raw);
        if (recordId) {
          const existing = await tx.user.findUnique({ where: { id: id(recordId) } });
          invariant(existing, "Usuario inexistente.");
          if (existing.isSuperuser && existing.isActive && (!data.isSuperuser || !data.isActive)) {
            invariant(await tx.user.count({ where: { isSuperuser: true, isActive: true, id: { not: recordId } } }) > 0,
              "Debe permanecer al menos un administrador activo.");
          }
          invariant(recordId !== actor.id || (data.isActive && data.isSuperuser),
            "No puedes quitar tu propio acceso administrativo.");
          const password = typeof raw.password === "string" ? raw.password : "";
          if (password) validatePassword(password, data.username);
          const revoke = Boolean(password) || existing.isActive !== data.isActive || existing.isSuperuser !== data.isSuperuser;
          await tx.user.update({ where: { id: recordId }, data: { ...data, isStaff: data.isSuperuser,
            ...(password ? { password: await hashPassword(password) } : {}),
            ...(revoke ? { sessionVersion: { increment: 1 } } : {}) } });
          if (revoke) await tx.session.deleteMany({ where: { userId: recordId } });
          savedId = recordId;
        } else {
          invariant(typeof raw.password === "string", "Ingresa una contraseña.");
          validatePassword(raw.password, data.username);
          savedId = (await tx.user.create({ data: { ...data, isStaff: data.isSuperuser, password: await hashPassword(raw.password) } })).id;
        }
        break;
      }
      case "careers": {
        const data = schemas.careers.parse(raw);
        savedId = (recordId ? await tx.career.update({ where: { id: recordId }, data }) : await tx.career.create({ data })).id;
        break;
      }
      case "years": {
        const data = schemas.years.parse(raw);
        if (recordId) invariant(!await tx.module.count({ where: { yearId: recordId } }) &&
          !await tx.enrollment.count({ where: { yearId: recordId } }), "La gestión en uso no puede renumerarse.");
        savedId = (recordId ? await tx.academicYear.update({ where: { id: recordId }, data }) : await tx.academicYear.create({ data })).id;
        break;
      }
      case "modules": {
        const parsed = schemas.modules.parse(raw);
        const year = await tx.academicYear.findUnique({ where: { id: parsed.yearId } });
        invariant(year, "Gestión inexistente.");
        const starts = dateOnly(parsed.starts), ends = dateOnly(parsed.ends);
        invariant(ends >= starts && starts.getUTCFullYear() === year.year && ends.getUTCFullYear() === year.year,
          "Las fechas deben pertenecer a la gestión y estar ordenadas.");
        if (recordId) {
          const previous = await tx.module.findUniqueOrThrow({ where: { id: recordId } });
          invariant(previous.yearId === parsed.yearId && previous.number === parsed.number,
            "La gestión y el número son inmutables; crea otro módulo.");
        }
        const data = { ...parsed, starts, ends };
        savedId = (recordId ? await tx.module.update({ where: { id: recordId }, data }) : await tx.module.create({ data })).id;
        break;
      }
      case "subjects": {
        const data = schemas.subjects.parse(raw);
        if (recordId && await tx.offering.count({ where: { subjectId: recordId } })) {
          const previous = await tx.subject.findUniqueOrThrow({ where: { id: recordId } });
          invariant(previous.careerId === data.careerId && previous.level === data.level && previous.part === data.part,
            "Una materia asignada debe conservar carrera, nivel y parte.");
        }
        savedId = (recordId ? await tx.subject.update({ where: { id: recordId }, data }) : await tx.subject.create({ data })).id;
        break;
      }
      case "students": {
        invariant(!recordId, "El expediente es inmutable. Usa las acciones de consulta y traslado.");
        const data = schemas.students.parse(raw);
        savedId = (await tx.student.create({ data })).id;
        break;
      }
      case "enrollments": {
        invariant(!recordId, "La matrícula es inmutable. Usa Cambiar turno.");
        savedId = (await tx.enrollment.create({ data: schemas.enrollments.parse(raw) })).id;
        break;
      }
      case "offerings": {
        const data = schemas.offerings.parse(raw);
        if (recordId) {
          const previous = await tx.offering.findUniqueOrThrow({ where: { id: recordId } });
          invariant(previous.subjectId === data.subjectId && previous.moduleId === data.moduleId && previous.shift === data.shift,
            "Solo puede cambiarse el docente de una oferta existente.");
        }
        savedId = (recordId ? await tx.offering.update({ where: { id: recordId }, data }) : await tx.offering.create({ data })).id;
        break;
      }
      case "registrations": {
        invariant(!recordId, "Las notas se modifican desde la planilla.");
        const data = schemas.registrations.parse(raw);
        const e = await tx.enrollment.findUniqueOrThrow({ where: { id: data.enrollmentId } });
        const o = await tx.offering.findUniqueOrThrow({ where: { id: data.offeringId }, include: { subject: true, module: true } });
        invariant(e.yearId === o.module.yearId && e.careerId === o.subject.careerId && e.level === o.subject.level && e.shift === o.shift,
          "La inscripción debe coincidir en gestión, carrera, nivel y turno.");
        savedId = (await tx.registration.create({ data })).id;
        break;
      }
      case "extensions": {
        const parsed = schemas.extensions.parse(raw);
        invariant(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(parsed.until), "Vencimiento inválido.");
        const until = new Date(parsed.until + ":00-04:00");
        invariant(Number.isFinite(until.getTime()) && until > new Date(), "El vencimiento debe estar en el futuro.");
        const data = { offeringId: parsed.offeringId, until, reason: reason(parsed.reason), authorizedById: actor.id };
        savedId = (recordId ? await tx.extension.update({ where: { id: recordId }, data }) : await tx.extension.create({ data })).id;
        break;
      }
    }
    await audit(tx, actor.id, recordId ? "Edición administrativa" : "Alta administrativa", `${catalogNames[kind]} #${savedId}`);
    return savedId;
  }, client);
}
