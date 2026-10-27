import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { invariant } from "../src/lib/rules";
import { hashPassword } from "../src/lib/password";
async function main() {
  invariant(process.argv.includes("--confirm-demo") && process.env.NODE_ENV !== "production",
    "Solo para desarrollo: agrega --confirm-demo y usa una base vacía.");
  const db = new PrismaClient();
  try {
    const password = await hashPassword("CeicomDemo2026!");
    await db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(8142026)`;
      if (await tx.user.findUnique({ where: { username: "admin_demo" } })) {
        console.log("La demostración ya existe. No se modificaron datos."); return;
      }
      invariant(await tx.user.count() + await tx.career.count() + await tx.academicYear.count() === 0, "La base contiene datos ajenos a la demostración.");
      await tx.user.create({ data: { username: "admin_demo", firstName: "Administración", lastName: "CEICOM", password, isSuperuser: true, isStaff: true, role: "ADMIN" } });
      const teacher = await tx.user.create({ data: { username: "docente_demo", firstName: "Carlos", lastName: "Rojas", password } });
      const user = await tx.user.create({ data: { username: "estudiante_demo", role: "STUDENT", firstName: "Ana", lastName: "López Vargas", password } });
      const today = Number(new Intl.DateTimeFormat("en", { timeZone: "America/La_Paz", year: "numeric" }).format(new Date()));
      const year = await tx.academicYear.create({ data: { year: today } });
      const career = await tx.career.create({ data: { name: "Sistemas Informáticos" } });
      await tx.career.create({ data: { name: "Contaduría General" } });
      const student = await tx.student.create({ data: { userId: user.id, code: "CEI-DEMO-001", entryYear: today - 2 } });
      const enrollment = await tx.enrollment.create({ data: { studentId: student.id, yearId: year.id, careerId: career.id, level: 3, shift: "M" } });
      const past = await tx.module.create({ data: { yearId: year.id, number: 1, starts: new Date(today + "-01-01"), ends: new Date(today + "-03-31") } });
      const current = await tx.module.create({ data: { yearId: year.id, number: 4, starts: new Date(today + "-10-01"), ends: new Date(today + "-12-31") } });
      const first = await tx.subject.create({ data: { careerId: career.id, name: "Programación III", level: 3, part: 1 } });
      const second = await tx.subject.create({ data: { careerId: career.id, name: "Programación III", level: 3, part: 2 } });
      const previous = await tx.offering.create({ data: { subjectId: first.id, moduleId: past.id, teacherId: teacher.id, shift: "M" } });
      const active = await tx.offering.create({ data: { subjectId: second.id, moduleId: current.id, teacherId: teacher.id, shift: "M" } });
      await tx.offering.create({ data: { subjectId: second.id, moduleId: current.id, teacherId: teacher.id, shift: "N" } });
      await tx.registration.create({ data: { enrollmentId: enrollment.id, offeringId: previous.id, grade: "78", published: true } });
      await tx.registration.create({ data: { enrollmentId: enrollment.id, offeringId: active.id } });
      console.log("Demostración creada: admin_demo / docente_demo / estudiante_demo. Contraseña local: CeicomDemo2026!");
    });
  } finally { await db.$disconnect(); }
}
main().catch(e => { console.error(e instanceof Error ? e.message : "No se pudo cargar la demostración."); process.exitCode = 1; });
