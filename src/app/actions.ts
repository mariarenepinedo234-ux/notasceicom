"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession, requireAdmin, requireUser, tokenHash } from "@/lib/auth";
import { atomic, audit, saveGrades, setVisibility, transferEnrollment } from "@/lib/academic";
import { isCatalog, saveCatalog } from "@/lib/catalog";
import { updateOwnPassword, updateOwnUsername } from "@/lib/people";
import { DomainError, id, invariant } from "@/lib/rules";
import { verifyPassword } from "@/lib/password";
function value(form: FormData, key: string) {
  const v = form.get(key);
  invariant(typeof v === "string", "Falta el campo " + key + ".");
  return v;
}
function errorMessage(error: unknown) {
  if (error instanceof DomainError) return error.message;
  if (error instanceof z.ZodError) return "Revisa los campos: " + error.issues.map(i => i.path.join(".") + " (" + i.message + ")").join("; ");
  console.error("No se pudo completar la operación:", error instanceof Error ? error.name : "Error");
  return "No se pudo guardar. Revisa los datos e inténtalo otra vez.";
}
async function run(path: string, fn: () => Promise<unknown>, success = "Cambios guardados.") {
  let message: string | undefined;
  try { await fn(); } catch (e) { message = errorMessage(e); }
  if (!message) revalidatePath("/", "layout");
  redirect(path + "?" + new URLSearchParams(message ? { error: message } : { success }));
}
export async function loginAction(form: FormData) {
  let message: string | undefined;
  let user: Awaited<ReturnType<typeof db.user.findUnique>> = null;
  try {
    const username = value(form, "username").trim(), password = value(form, "password");
    invariant(username.length > 0 && username.length <= 150 && password.length <= 256, "Credenciales inválidas.");
    const key = tokenHash("login:" + username.toLowerCase());
    const attempts = await db.$queryRaw<{ count: number }[]>`
      INSERT INTO "LoginAttempt" ("key", "count", "window") VALUES (${key}, 1, NOW())
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "LoginAttempt"."window" < NOW() - INTERVAL '15 minutes' THEN 1 ELSE "LoginAttempt"."count" + 1 END,
        "window" = CASE WHEN "LoginAttempt"."window" < NOW() - INTERVAL '15 minutes' THEN NOW() ELSE "LoginAttempt"."window" END
      RETURNING "count"`;
    invariant(attempts[0].count <= 10, "Demasiados intentos. Espera 15 minutos.");
    user = await db.user.findUnique({ where: { username } });
    const dummy = "scrypt$ceicom-dummy$" + Buffer.alloc(64).toString("base64");
    const valid = await verifyPassword(password, user?.password ?? dummy);
    invariant(valid && user?.isActive, "Usuario o contraseña incorrectos.");
    await createSession(user);
  } catch (e) { message = errorMessage(e); }
  if (message) redirect("/login?" + new URLSearchParams({ error: message }));
  redirect(user?.mustChangePassword ? "/password" : "/");
}
export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
export async function passwordAction(form: FormData) {
  const actor = await requireUser({ allowTemporary: true });
  let message: string | undefined;
  try {
    const previous = value(form, "currentPassword"), next = value(form, "password");
    invariant(next === value(form, "confirmPassword"), "Las contraseñas no coinciden.");
    const updated = await updateOwnPassword(actor.id, previous, next);
    await createSession(updated);
  } catch (e) { message = errorMessage(e); }
  redirect("/password?" + new URLSearchParams(message ? { error: message } : { success: "Contraseña actualizada." }));
}
export async function gradebookAction(form: FormData) {
  const actor = await requireUser();
  const offeringId = id(value(form, "offeringId"));
  await run("/materia/" + offeringId, async () => {
    const entries = [...form.entries()].filter(([key]) => /^version_\d+$/.test(key)).map(([key, version]) => {
      const rowId = id(key.slice(8));
      return { id: rowId, version: Number(version), grade: String(form.get("grade_" + rowId) ?? ""),
        published: form.get("publish_" + rowId) === "on" };
    });
    await saveGrades(actor.id, offeringId, entries, String(form.get("reason") ?? ""));
  }, "Notas guardadas. Solo las publicadas son visibles para el estudiante.");
}
export async function visibilityAction(form: FormData) {
  const actor = await requireAdmin();
  const studentId = id(value(form, "studentId"));
  await run("/consulta/" + studentId, () => setVisibility(actor.id, studentId,
    value(form, "enabled") === "true", value(form, "reason")));
}
export async function transferAction(form: FormData) {
  const actor = await requireAdmin();
  const enrollmentId = id(value(form, "enrollmentId"));
  await run("/traslado/" + enrollmentId, () => transferEnrollment(actor.id, enrollmentId,
    value(form, "shift"), value(form, "reason")), "Traslado registrado; se conservaron las notas y el historial.");
}
export async function catalogAction(form: FormData) {
  const actor = await requireAdmin();
  const kind = value(form, "kind");
  invariant(isCatalog(kind), "Catálogo inválido.");
  const record = value(form, "recordId");
  const recordId = record ? id(record) : null;
  await run("/admin/" + kind, () => {
    const raw: Record<string, unknown> = Object.fromEntries(form.entries());
    if (["users", "students", "teachers"].includes(kind)) {
      raw.isActive = form.get("isActive") === "on";
      raw.isSuperuser = form.get("isSuperuser") === "on";
    }
    return saveCatalog(actor.id, kind, recordId, raw);
  });
}

export async function accountAction(form: FormData) {
  const actor = await requireUser();
  let message: string | undefined;
  try {
    const updated = await updateOwnUsername(actor.id, value(form, "username"), value(form, "currentPassword"));
    await createSession(updated);
  } catch (e) { message = errorMessage(e); }
  if (!message) revalidatePath("/", "layout");
  redirect("/account?" + new URLSearchParams(message ? { error: message } : { success: "Usuario actualizado. Tu CI y expediente se conservan." }));
}
