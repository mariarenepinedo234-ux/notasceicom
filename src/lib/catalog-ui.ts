import { db } from "./db";
import { type Catalog } from "./catalog";
import { displayName, shiftName } from "./rules";
export type Option = { value: string; label: string };
export type Field = { name: string; label: string; type?: "text" | "number" | "date" | "datetime-local" | "checkbox" | "email" | "password" | "textarea";
  options?: Option[]; required?: boolean; min?: number; max?: number; maxLength?: number; immutable?: boolean };
export type CatalogRow = { id: number; title: string; detail: string; values: Record<string, unknown> };
export async function catalogView(kind: Catalog): Promise<{ fields: Field[]; rows: CatalogRow[]; editable: boolean }> {
  const [users, careers, years, modules, subjects, students, enrollments, offerings] = await Promise.all([
    db.user.findMany({ select: { id: true, username: true, firstName: true, lastName: true, email: true, isActive: true, isSuperuser: true }, orderBy: { username: "asc" } }),
    db.career.findMany({ orderBy: { name: "asc" } }),
    db.academicYear.findMany({ orderBy: { year: "desc" } }),
    db.module.findMany({ include: { year: true }, orderBy: [{ year: { year: "desc" } }, { number: "asc" }] }),
    db.subject.findMany({ include: { career: true }, orderBy: [{ name: "asc" }, { part: "asc" }] }),
    db.student.findMany({ include: { user: { select: { username: true, firstName: true, lastName: true } } }, orderBy: { code: "asc" } }),
    db.enrollment.findMany({ include: { student: true, year: true, career: true } }),
    db.offering.findMany({ include: { subject: true, module: { include: { year: true } }, teacher: { select: { username: true, firstName: true, lastName: true } } } }),
  ]);
  const select = (name: string, label: string, options: Option[], immutable = false): Field => ({ name, label, options, required: true, immutable });
  const opts = <T extends { id: number }>(rows: T[], label: (v: T) => string): Option[] => rows.map(v => ({ value: String(v.id), label: "#" + v.id + " · " + label(v) }));
  const userOptions = opts(users, u => displayName(u) + " (" + u.username + ")");
  const subjectOptions = opts(subjects, s => s.name + " · Parte " + s.part + " · " + s.career.name);
  const offeringLabel = (o: typeof offerings[number]) => o.subject.name + " P" + o.subject.part + " · " + o.module.year.year + " / M" + o.module.number + " · " + shiftName(o.shift);
  const shiftOptions = ["M", "T", "N"].map(s => ({ value: s, label: shiftName(s) }));
  const level: Field = { name: "level", label: "Año de carrera", type: "number", min: 1, max: 3, required: true };
  const name: Field = { name: "name", label: "Nombre", maxLength: 150, required: true };
  const row = (v: { id: number }, title: string, detail: string): CatalogRow => ({ id: v.id, title, detail, values: { ...v } });
  switch (kind) {
    case "users": return { editable: true, fields: [
      { name: "username", label: "Usuario", maxLength: 150, required: true },
      { name: "firstName", label: "Nombres", maxLength: 150 }, { name: "lastName", label: "Apellidos", maxLength: 150 },
      { name: "email", label: "Correo", type: "email", maxLength: 254 },
      { name: "password", label: "Contraseña (vacía al editar conserva la actual)", type: "password", maxLength: 256 },
      { name: "isActive", label: "Cuenta activa", type: "checkbox" },
      { name: "isSuperuser", label: "Administrador", type: "checkbox" },
    ], rows: users.map(u => row(u, displayName(u), u.username + " · " + (u.isSuperuser ? "Administración" : "Cuenta") + " · " + (u.isActive ? "Activa" : "Inactiva"))) };
    case "careers": return { editable: true, fields: [name], rows: careers.map(c => row(c, c.name, "Carrera")) };
    case "years": return { editable: true, fields: [{ name: "year", label: "Gestión", type: "number", min: 2000, max: 2200, required: true }],
      rows: years.map(y => row(y, String(y.year), "Gestión académica")) };
    case "modules": return { editable: true, fields: [
      select("yearId", "Gestión", opts(years, y => String(y.year)), true),
      { name: "number", label: "Módulo", type: "number", min: 1, max: 4, required: true, immutable: true },
      { name: "starts", label: "Inicio", type: "date", required: true }, { name: "ends", label: "Fin", type: "date", required: true },
    ], rows: modules.map(m => row(m, m.year.year + " · Módulo " + m.number, m.starts.toISOString().slice(0, 10) + " → " + m.ends.toISOString().slice(0, 10))) };
    case "subjects": return { editable: true, fields: [select("careerId", "Carrera", opts(careers, c => c.name)), name, level,
      { name: "part", label: "Parte", type: "number", min: 1, max: 2, required: true }],
      rows: subjects.map(s => row(s, s.name + " · Parte " + s.part, s.career.name + " · Año " + s.level)) };
    case "students": return { editable: false, fields: [
      select("userId", "Usuario", userOptions), { name: "code", label: "Código", maxLength: 30, required: true },
      { name: "entryYear", label: "Gestión de ingreso", type: "number", min: 0, max: 9999, required: true },
    ], rows: students.map(s => row(s, s.code + " · " + displayName(s.user), "Ingreso " + s.entryYear + " · Consulta " + (s.canViewGrades ? "habilitada" : "restringida"))) };
    case "enrollments": return { editable: false, fields: [
      select("studentId", "Estudiante", opts(students, s => s.code + " · " + displayName(s.user))),
      select("yearId", "Gestión", opts(years, y => String(y.year))),
      select("careerId", "Carrera", opts(careers, c => c.name)), level, select("shift", "Turno", shiftOptions),
    ], rows: enrollments.map(e => row(e, e.student.code + " · " + e.career.name, e.year.year + " · Año " + e.level + " · " + shiftName(e.shift))) };
    case "offerings": return { editable: true, fields: [
      select("subjectId", "Materia / parte", subjectOptions, true),
      select("moduleId", "Módulo", opts(modules, m => m.year.year + " · Módulo " + m.number), true),
      select("teacherId", "Docente", userOptions), select("shift", "Turno", shiftOptions, true),
    ], rows: offerings.map(o => row(o, offeringLabel(o), "Docente: " + displayName(o.teacher))) };
    case "registrations": {
      const registrations = await db.registration.findMany({ include: { enrollment: { include: { student: true } }, offering: { include: { subject: true } } } });
      return { editable: false, fields: [
        select("enrollmentId", "Matrícula", opts(enrollments, e => e.student.code + " · " + e.career.name + " · " + e.year.year + " · " + shiftName(e.shift))),
        select("offeringId", "Oferta", opts(offerings, offeringLabel)),
      ], rows: registrations.map(r => row(r, r.enrollment.student.code + " · " + r.offering.subject.name + " P" + r.offering.subject.part,
        (r.grade?.toString() ?? "Pendiente") + " · " + (r.published ? "Publicada" : "Borrador") + " · Oferta #" + r.offeringId)) };
    }
    case "extensions": {
      const extensions = await db.extension.findMany({ include: { offering: { include: { subject: true } } }, orderBy: { until: "desc" } });
      return { editable: true, fields: [
        select("offeringId", "Oferta autorizada", opts(offerings, offeringLabel)),
        { name: "until", label: "Habilitada hasta (hora de Bolivia)", type: "datetime-local", required: true },
        { name: "reason", label: "Motivo", type: "textarea", maxLength: 4000, required: true },
      ], rows: extensions.map(e => row(e, e.offering.subject.name + " · Oferta #" + e.offeringId, e.reason)) };
    }
  }
}
