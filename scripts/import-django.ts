import "dotenv/config";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { dateOnly, invariant } from "../src/lib/rules";
const fixtureSchema = z.array(z.object({ model: z.string(), pk: z.number().int().positive(), fields: z.record(z.string(), z.unknown()) }));
const n = z.number().int().positive();
const s = z.string();
const b = z.boolean();
const date = (v: unknown) => dateOnly(s.parse(v));
const instant = (v: unknown) => {
  const parsed = z.iso.datetime({ offset: true }).parse(v);
  return new Date(parsed);
};
const order = ["auth.user", "academics.career", "academics.academicyear", "academics.module", "academics.subject",
  "academics.student", "academics.enrollment", "academics.offering", "academics.registration", "academics.extension", "academics.auditevent"];
export async function importDjango(input: unknown, client: PrismaClient) {
  const rows = fixtureSchema.parse(input);
  const seen = new Set<string>();
  for (const r of rows) {
    invariant(order.includes(r.model), "Modelo no compatible en la exportación: " + r.model);
    const key = r.model + ":" + r.pk;
    invariant(!seen.has(key), "Identificador duplicado en la exportación: " + key); seen.add(key);
  }
  await client.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(8142026)`;
    invariant(await tx.user.count() + await tx.career.count() + await tx.academicYear.count() + await tx.auditEvent.count() === 0,
      "La importación exige una base PostgreSQL vacía. No se sobrescribieron datos.");
    for (const model of order) for (const row of rows.filter(r => r.model === model)) {
      const f = row.fields, id = row.pk;
      switch (model) {
        case "auth.user": {
          const password = s.parse(f.password);
          invariant(password.startsWith("!") || /^pbkdf2_sha(256|1)\$[1-9]\d*\$[^$]+\$[A-Za-z0-9+/=]+$/.test(password),
            "Hash de contraseña no compatible para usuario #" + id + ". Agrega soporte para ese algoritmo antes de migrar.");
          await tx.user.create({ data: { id, username: s.parse(f.username), password,
            firstName: s.parse(f.first_name), lastName: s.parse(f.last_name), email: s.parse(f.email),
            isActive: b.parse(f.is_active), isSuperuser: b.parse(f.is_superuser), isStaff: b.parse(f.is_staff), dateJoined: instant(f.date_joined) } });
          break;
        }
        case "academics.career": await tx.career.create({ data: { id, name: s.parse(f.name) } }); break;
        case "academics.academicyear": await tx.academicYear.create({ data: { id, year: n.parse(f.year) } }); break;
        case "academics.module": await tx.module.create({ data: { id, yearId: n.parse(f.year), number: n.parse(f.number), starts: date(f.starts), ends: date(f.ends) } }); break;
        case "academics.subject": await tx.subject.create({ data: { id, careerId: n.parse(f.career), name: s.parse(f.name), level: n.parse(f.level), part: n.parse(f.part) } }); break;
        case "academics.student": await tx.student.create({ data: { id, userId: n.parse(f.user), code: s.parse(f.code), entryYear: z.number().int().nonnegative().parse(f.entry_year), canViewGrades: b.parse(f.can_view_grades) } }); break;
        case "academics.enrollment": await tx.enrollment.create({ data: { id, studentId: n.parse(f.student), yearId: n.parse(f.year), careerId: n.parse(f.career), level: n.parse(f.level), shift: s.parse(f.shift) } }); break;
        case "academics.offering": await tx.offering.create({ data: { id, subjectId: n.parse(f.subject), moduleId: n.parse(f.module), teacherId: n.parse(f.teacher), shift: s.parse(f.shift) } }); break;
        case "academics.registration": {
          const grade = f.grade === null ? null : s.parse(f.grade);
          // No redondear datos de origen silenciosamente.
          invariant(grade === null || /^\d{1,3}(\.\d{1,2})?$/.test(grade) && Number(grade) >= 1 && Number(grade) <= 100,
            "Nota inválida en inscripción #" + id);
          await tx.registration.create({ data: { id, enrollmentId: n.parse(f.enrollment), offeringId: n.parse(f.offering), grade, published: b.parse(f.published) } });
          break;
        }
        case "academics.extension": await tx.extension.create({ data: { id, offeringId: n.parse(f.offering), until: instant(f.until), reason: s.parse(f.reason), authorizedById: n.parse(f.authorized_by), createdAt: instant(f.created_at) } }); break;
        case "academics.auditevent": await tx.auditEvent.create({ data: { id, actorId: n.parse(f.actor), action: s.parse(f.action), details: s.parse(f.details), createdAt: instant(f.created_at) } }); break;
      }
    }
    // Valida invariantes relacionales que no se expresan con una FK simple.
    const invalid = await tx.$queryRaw<{ id: number }[]>`
      SELECT m."id" FROM "Module" m JOIN "AcademicYear" y ON m."yearId" = y."id"
      WHERE EXTRACT(YEAR FROM m."starts") <> y."year" OR EXTRACT(YEAR FROM m."ends") <> y."year"
      UNION ALL
      SELECT r."id" FROM "Registration" r JOIN "Enrollment" e ON r."enrollmentId" = e."id"
      JOIN "Offering" o ON r."offeringId" = o."id" JOIN "Module" m ON o."moduleId" = m."id"
      JOIN "Subject" s ON o."subjectId" = s."id"
      WHERE e."yearId" <> m."yearId" OR e."careerId" <> s."careerId" OR e."level" <> s."level"`;
    invariant(!invalid.length, "El origen contiene módulos o inscripciones inconsistentes. Se revirtió toda la importación.");
    // Las notas históricas pueden conservar turnos distintos a la matrícula después de un traslado.
    for (const table of ["User", "Career", "AcademicYear", "Module", "Subject", "Student", "Enrollment", "Offering", "Registration", "Extension", "AuditEvent"]) {
      // Identificadores de esta lista fija; no proceden del archivo.
      await tx.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE(MAX("id"), 1), MAX("id") IS NOT NULL) FROM "${table}"`);
    }
    for (const model of order) {
      const table = ({ "auth.user": "User", "academics.career": "Career", "academics.academicyear": "AcademicYear",
        "academics.module": "Module", "academics.subject": "Subject", "academics.student": "Student",
        "academics.enrollment": "Enrollment", "academics.offering": "Offering", "academics.registration": "Registration",
        "academics.extension": "Extension", "academics.auditevent": "AuditEvent" } as Record<string, string>)[model];
      const result = await tx.$queryRawUnsafe<{ count: bigint }[]>(`SELECT COUNT(*) AS count FROM "${table}"`);
      invariant(Number(result[0].count) === rows.filter(r => r.model === model).length, "No coinciden los recuentos de " + model);
    }
  }, { timeout: 120000, maxWait: 10000 });
  return Object.fromEntries(order.map(model => [model, rows.filter(r => r.model === model).length]));
}
async function main() {
  invariant(process.argv.includes("--confirm-empty-target"), "Requiere --confirm-empty-target y un destino PostgreSQL vacío.");
  const filename = process.argv[2];
  invariant(filename && !filename.startsWith("--"), "Indica el archivo JSON exportado de Django.");
  const db = new PrismaClient();
  try {
    const counts = await importDjango(JSON.parse(await readFile(filename, "utf8")), db);
    console.log("Importación completa. Recuentos verificados:", counts);
  } finally { await db.$disconnect(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => { console.error(e instanceof Error ? e.message : "Error de importación"); process.exitCode = 1; });
}
