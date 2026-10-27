export const shifts = { M: "Mañana", T: "Tarde", N: "Noche" } as const;
export type Shift = keyof typeof shifts;
export function shiftName(value: string) { return shifts[value as Shift] ?? value; }
export class DomainError extends Error {}
export function invariant(value: unknown, message: string): asserts value {
  if (!value) throw new DomainError(message);
}
export function id(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  invariant(Number.isSafeInteger(n) && n > 0, "Identificador inválido.");
  return n;
}
export function dateOnly(value: string): Date {
  invariant(/^\d{4}-\d{2}-\d{2}$/.test(value), "Fecha inválida.");
  const d = new Date(value + "T00:00:00.000Z");
  invariant(Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value, "Fecha inválida.");
  return d;
}
// America/La_Paz: UTC-04 sin cambio estacional. La fecha DATE se interpreta como fecha civil.
export function deadlineFor(end: Date | string): Date {
  const day = dateOnly(typeof end === "string" ? end : end.toISOString().slice(0, 10));
  let count = 0;
  while (count < 3) {
    day.setUTCDate(day.getUTCDate() + 1);
    if (day.getUTCDay() !== 0 && day.getUTCDay() !== 6) count++;
  }
  day.setUTCDate(day.getUTCDate() + 1);
  day.setUTCHours(4);
  return day;
}
export function canEdit(actor: { id: number; isSuperuser: boolean }, offering: {
  teacherId: number; module: { ends: Date }; extensions: { until: Date }[];
}, now = new Date()) {
  return actor.isSuperuser || (offering.teacherId === actor.id &&
    (now < deadlineFor(offering.module.ends) || offering.extensions.some(e => e.until > now)));
}
export function parseGrade(raw: unknown): string | null {
  invariant(typeof raw === "string", "Nota inválida.");
  const s = raw.trim();
  if (!s) return null;
  invariant(/^\d{1,3}(\.\d{1,2})?$/.test(s) && Number(s) >= 1 && Number(s) <= 100,
    "La nota debe estar entre 1 y 100, con hasta dos decimales.");
  return Number(s).toFixed(2);
}
export function result(grade: { toString(): string } | string | null) {
  return grade === null ? "Pendiente" : Number(grade.toString()) >= 61 ? "Aprobado" : "Reprobado";
}
export function csvCell(value: unknown) {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r\n]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
export function displayName(u: { firstName: string; lastName: string; username: string }) {
  return (u.firstName + " " + u.lastName).trim() || u.username;
}
export function localTime(date: Date) {
  return new Intl.DateTimeFormat("es-BO", { timeZone: "America/La_Paz", dateStyle: "short", timeStyle: "short" }).format(date);
}
export function reason(value: unknown) {
  invariant(typeof value === "string" && value.trim().length > 0 && value.length <= 4000,
    "Indica un motivo de hasta 4000 caracteres.");
  return value.trim();
}
