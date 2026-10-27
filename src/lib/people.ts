import { Role } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { actorIn, atomic, audit } from "./academic";
import { id, invariant } from "./rules";
import { hashPassword, validatePassword, verifyPassword } from "./password";
export const roleLabels = { ADMIN: "Administrador", TEACHER: "Docente", STUDENT: "Estudiante" } as const;
export const usernameSchema = z.string().trim().min(1).max(150).regex(/^[\p{L}\p{N}_.@+\-]+$/u);
const personSchema = z.object({
  firstName: z.string().trim().max(150), lastName: z.string().trim().max(150),
  email: z.union([z.literal(""), z.email().max(254)]), isActive: z.boolean(),
});
export function normalizeCi(raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === "") return null;
  invariant(typeof raw === "string", "CI inválido.");
  const ci = raw.trim().toUpperCase();
  invariant(/^[0-9][0-9A-Z-]{3,29}$/.test(ci), "Ingresa el CI sin espacios, de 4 a 30 caracteres; admite complemento con guion.");
  return ci;
}
export async function savePerson(actorId: number, kind: "users" | "students" | "teachers", recordId: number | null,
  raw: Record<string, unknown>, client = db) {
  return atomic(async tx => {
    const actor = await actorIn(tx, actorId, true);
    const studentRecord = kind === "students" && recordId
      ? await tx.student.findUnique({ where: { id: id(recordId) } }) : null;
    invariant(kind !== "students" || !recordId || studentRecord, "Estudiante inexistente.");
    const userId = kind === "students" ? studentRecord?.userId : recordId;
    const existing = userId ? await tx.user.findUnique({ where: { id: id(userId) }, include: { student: true } }) : null;
    invariant(!recordId || existing, "Usuario inexistente.");
    const role = z.enum(Role).parse(kind === "students" ? "STUDENT" : kind === "teachers" ? "TEACHER" :
      raw.role ?? (raw.isSuperuser === true ? "ADMIN" : existing?.role ?? "TEACHER"));
    const data = personSchema.parse(raw);
    const ci = normalizeCi(raw.ci === undefined ? existing?.ci : raw.ci);
    invariant(role === "ADMIN" || (data.firstName && data.lastName), "Completa nombres y apellidos.");
    invariant(existing || role === "ADMIN" || ci, "El CI es obligatorio para crear estudiantes y docentes.");
    invariant(!existing?.student || role !== "TEACHER", "Este usuario tiene un expediente de estudiante. Conserva su rol para mantener el acceso al historial.");
    if (role === "STUDENT" && existing && existing.role !== "STUDENT") {
      invariant(!await tx.offering.count({ where: { teacherId: existing.id } }), "El usuario tiene asignaciones docentes; reasígnalas antes de cambiar su rol.");
    }
    const username = existing ? usernameSchema.parse(raw.username ?? existing.username) :
      role === "ADMIN" ? usernameSchema.parse(raw.username) : ci!;
    invariant(!await tx.user.findFirst({ where: { ci: username, ...(existing ? { id: { not: existing.id } } : {}) } }),
      "Ese usuario está reservado por el CI de otra persona.");
    if (ci) invariant(!await tx.user.findFirst({ where: { username: ci, ...(existing ? { id: { not: existing.id } } : {}) } }),
      "El CI coincide con el usuario de otra persona.");
    const studentData = role === "STUDENT" ? z.object({
      code: z.string().trim().min(1).max(30), entryYear: z.coerce.number().int().min(1900).max(2200),
    }).parse(raw) : null;
    let password: string | undefined;
    if (!existing && role !== "ADMIN") password = await hashPassword(ci!);
    else if (typeof raw.password === "string" && raw.password) {
      validatePassword(raw.password, username);
      invariant(!ci || raw.password !== ci, "La contraseña nueva debe ser distinta del CI.");
      password = await hashPassword(raw.password);
    }
    invariant(existing || password, "Ingresa una contraseña para el administrador.");
    if (existing?.isSuperuser && existing.isActive && (role !== "ADMIN" || !data.isActive)) {
      invariant(await tx.user.count({ where: { isSuperuser: true, isActive: true, id: { not: existing.id } } }) > 0,
        "Debe permanecer al menos un administrador activo.");
    }
    invariant(existing?.id !== actor.id || (data.isActive && role === "ADMIN"), "No puedes quitar tu propio acceso administrativo.");
    const revoke = Boolean(existing && (password || existing.role !== role || existing.isActive !== data.isActive || existing.username !== username));
    const common = { ...data, ci, username, role, isSuperuser: role === "ADMIN", isStaff: role === "ADMIN" };
    const user = existing ? await tx.user.update({ where: { id: existing.id }, data: { ...common,
      ...(password ? { password, mustChangePassword: role !== "ADMIN" } : {}),
      ...(revoke ? { sessionVersion: { increment: 1 } } : {}) } }) :
      await tx.user.create({ data: { ...common, password: password!, mustChangePassword: role !== "ADMIN" } });
    if (revoke) await tx.session.deleteMany({ where: { userId: user.id } });
    let savedId = user.id;
    if (studentData) {
      const student = existing?.student ? await tx.student.update({ where: { id: existing.student.id }, data: studentData }) :
        await tx.student.create({ data: { ...studentData, userId: user.id } });
      if (kind === "students") savedId = student.id;
    }
    const before = existing ? `Antes: ${existing.firstName} ${existing.lastName}, CI=${existing.ci ?? "sin registrar"}, usuario=${existing.username}, rol=${existing.role}. ` : "";
    await audit(tx, actor.id, existing ? "Edición de persona" : "Registro de persona",
      `${before}Usuario #${user.id}: ${user.firstName} ${user.lastName}, CI=${ci ?? "sin registrar"}, rol=${roleLabels[role]}` +
      (studentData ? `, matrícula=${studentData.code}, ingreso=${studentData.entryYear}` : ""));
    return savedId;
  }, client);
}
export async function updateOwnUsername(actorId: number, usernameRaw: unknown, currentPassword: string, client = db) {
  const username = usernameSchema.parse(usernameRaw);
  const before = await client.user.findUnique({ where: { id: id(actorId) } });
  invariant(before?.isActive && !before.mustChangePassword, "Primero cambia tu contraseña temporal.");
  invariant(await verifyPassword(currentPassword, before.password), "La contraseña actual es incorrecta.");
  return atomic(async tx => {
    await actorIn(tx, actorId);
    invariant(!await tx.user.findFirst({ where: { ci: username, id: { not: actorId } } }), "Ese usuario está reservado por el CI de otra persona.");
    const changed = await tx.user.updateMany({ where: { id: actorId, password: before.password, sessionVersion: before.sessionVersion, isActive: true },
      data: { username, sessionVersion: { increment: 1 } } });
    invariant(changed.count === 1, "La cuenta cambió. Inicia sesión otra vez.");
    await tx.session.deleteMany({ where: { userId: actorId } });
    await audit(tx, actorId, "Cambio de usuario", `${before.username} → ${username}. CI y expediente conservados.`);
    return tx.user.findUniqueOrThrow({ where: { id: actorId } });
  }, client);
}

export async function updateOwnPassword(actorId: number, currentPassword: string, next: string, client = db) {
  const before = await client.user.findUnique({ where: { id: id(actorId) } });
  invariant(before?.isActive, "La cuenta no está habilitada.");
  validatePassword(next, before.username);
  invariant(!before.ci || next !== before.ci, "La contraseña nueva debe ser distinta del CI.");
  invariant(await verifyPassword(currentPassword, before.password), "La contraseña actual es incorrecta.");
  const password = await hashPassword(next);
  return atomic(async tx => {
    const changed = await tx.user.updateMany({ where: { id: actorId, password: before.password, sessionVersion: before.sessionVersion, isActive: true },
      data: { password, mustChangePassword: false, sessionVersion: { increment: 1 } } });
    invariant(changed.count === 1, "La cuenta cambió. Inicia sesión otra vez.");
    await tx.session.deleteMany({ where: { userId: actorId } });
    await audit(tx, actorId, "Cambio de contraseña", "Contraseña cambiada por su titular; sesiones anteriores revocadas.");
    return tx.user.findUniqueOrThrow({ where: { id: actorId } });
  }, client);
}
