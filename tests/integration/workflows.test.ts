import { after, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { pbkdf2Sync } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { accessibleOffering, saveGrades, setVisibility, studentResults, transferEnrollment } from "../../src/lib/academic";
import { savePerson, updateOwnPassword, updateOwnUsername } from "../../src/lib/people";
import { saveCatalog } from "../../src/lib/catalog";
import { deadlineFor, invariant } from "../../src/lib/rules";
import { verifyPassword } from "../../src/lib/password";
import { importDjango } from "../../scripts/import-django";
const connection = process.env.DATABASE_URL;
invariant(connection && new URL(connection).pathname.endsWith("_test") && process.env.CEICOM_TEST_DB === "1",
  "Las pruebas requieren una base separada con nombre terminado en _test y CEICOM_TEST_DB=1.");
const db = new PrismaClient();
const tables = '"Session", "LoginAttempt", "AuditEvent", "Extension", "Registration", "Offering", "Enrollment", "Student", "Subject", "Module", "AcademicYear", "Career", "User"';
async function clear() { await db.$executeRawUnsafe("TRUNCATE TABLE " + tables + " RESTART IDENTITY CASCADE"); }
async function fixture() {
  const admin = await db.user.create({ data: { username: "admin", password: "!", isSuperuser: true, role: "ADMIN" } });
  const teacher = await db.user.create({ data: { username: "teacher", password: "!" } });
  const other = await db.user.create({ data: { username: "other", password: "!" } });
  const su = await db.user.create({ data: { username: "student", role: "STUDENT", firstName: "Ana", password: "!" } });
  const student = await db.student.create({ data: { userId: su.id, code: "S001", entryYear: 2024 } });
  const career = await db.career.create({ data: { name: "Sistemas" } });
  const yr = new Date().getUTCFullYear() + 1;
  const year = await db.academicYear.create({ data: { year: yr } });
  const module = await db.module.create({ data: { yearId: year.id, number: 1, starts: new Date(yr + "-01-01"), ends: new Date(yr + "-03-31") } });
  const subject = await db.subject.create({ data: { careerId: career.id, name: "Programación I", level: 1, part: 1 } });
  const enrollment = await db.enrollment.create({ data: { studentId: student.id, yearId: year.id, careerId: career.id, level: 1, shift: "M" } });
  const offering = await db.offering.create({ data: { subjectId: subject.id, moduleId: module.id, teacherId: teacher.id, shift: "M" } });
  const destination = await db.offering.create({ data: { subjectId: subject.id, moduleId: module.id, teacherId: teacher.id, shift: "N" } });
  const row = await db.registration.create({ data: { enrollmentId: enrollment.id, offeringId: offering.id } });
  return { admin, teacher, other, su, student, career, year, module, subject, enrollment, offering, destination, row };
}
let x: Awaited<ReturnType<typeof fixture>>;
const input = (grade = "61", published = true, version = 0) => [{ id: x.row.id, grade, published, version }];
describe("paridad de flujos académicos sobre PostgreSQL", () => {
  beforeEach(async () => { await clear(); x = await fixture(); });
  after(async () => { await clear(); await db.$disconnect(); });
  test("solo administración y docente asignado pueden consultar o guardar una oferta", async () => {
    for (const u of [x.other, x.su]) {
      assert.equal(await accessibleOffering(u, x.offering.id, db), null);
      await assert.rejects(saveGrades(u.id, x.offering.id, input(), "", db));
    }
    assert.ok(await accessibleOffering(x.admin, x.offering.id, db));
    await assert.rejects(setVisibility(x.teacher.id, x.student.id, false, "Intento", db));
    await assert.rejects(transferEnrollment(x.su.id, x.enrollment.id, "N", "Intento", db));
    await assert.rejects(saveCatalog(x.teacher.id, "careers", null, { name: "No autorizado" }, db));
  });
  test("borrador, publicación, visibilidad propia y filtros", async () => {
    await saveGrades(x.teacher.id, x.offering.id, input("61", false), "", db);
    assert.equal((await studentResults(x.su.id, "", "", db)).length, 0);
    await saveGrades(x.teacher.id, x.offering.id, input("61", true, 1), "", db);
    assert.equal((await studentResults(x.su.id, String(x.year.year), "1", db))[0].grade?.toString(), "61");
    assert.equal((await studentResults(x.su.id, String(x.year.year - 1), "", db)).length, 0);
    assert.equal((await studentResults(x.su.id, "", "2", db)).length, 0);
    assert.equal((await studentResults(x.su.id, "no-numero", "", db)).length, 0);
    const otherUser = await db.user.create({ data: { username: "student2", password: "!" } });
    await db.student.create({ data: { userId: otherUser.id, code: "S002", entryYear: 2024 } });
    assert.equal((await studentResults(otherUser.id, "", "", db)).length, 0);
    assert.equal(await db.auditEvent.count({ where: { action: "Registro de nota" } }), 2);
  });
  test("notas inválidas y publicación vacía no cambian datos ni auditoría", async () => {
    for (const grade of ["0", "101", "NaN", "", "61.123"]) await assert.rejects(saveGrades(x.teacher.id, x.offering.id, input(grade), "", db));
    assert.equal((await db.registration.findUniqueOrThrow({ where: { id: x.row.id } })).grade, null);
    assert.equal(await db.auditEvent.count(), 0);
    await saveGrades(x.teacher.id, x.offering.id, input("", false), "", db);
  });
  test("corrección de publicación solo por administración, con motivo y estado anterior", async () => {
    await saveGrades(x.teacher.id, x.offering.id, input("78"), "", db);
    await saveGrades(x.teacher.id, x.offering.id, input("99", true, 1), "Intento", db);
    assert.equal((await db.registration.findUniqueOrThrow({ where: { id: x.row.id } })).grade?.toString(), "78");
    await assert.rejects(saveGrades(x.admin.id, x.offering.id, input("99", true, 1), "", db));
    await saveGrades(x.admin.id, x.offering.id, input("99", true, 1), "Corrección de transcripción", db);
    const event = await db.auditEvent.findFirstOrThrow({ orderBy: { id: "desc" } });
    assert.match(event.details, /78/); assert.match(event.details, /99/); assert.match(event.details, /Corrección/);
  });
  test("carga vencida rechazada en servidor, reapertura y vencimiento exclusivo", async () => {
    const now = deadlineFor(x.module.ends);
    await assert.rejects(saveGrades(x.teacher.id, x.offering.id, input(), "", db, now));
    await db.extension.create({ data: { offeringId: x.offering.id, until: new Date(now.getTime() + 3600000), reason: "Excepción", authorizedById: x.admin.id } });
    await saveGrades(x.teacher.id, x.offering.id, input("61", false), "", db, now);
    await assert.rejects(saveGrades(x.teacher.id, x.offering.id, input("62", false, 1), "", db, new Date(now.getTime() + 3600000)));
  });
  test("restricción y rehabilitación auditadas sin borrar ni exponer resultados", async () => {
    await saveGrades(x.teacher.id, x.offering.id, input(), "", db);
    await setVisibility(x.admin.id, x.student.id, false, "Revisión", db);
    assert.equal((await studentResults(x.su.id, "", "", db)).length, 0);
    assert.equal(await db.registration.count(), 1);
    await setVisibility(x.admin.id, x.student.id, true, "Regularizado", db);
    assert.equal((await studentResults(x.su.id, "", "", db)).length, 1);
    assert.equal(await db.auditEvent.count({ where: { action: "Consulta de notas" } }), 2);
  });
  test("traslado conserva notas publicadas, turno histórico, borradores y otras gestiones", async () => {
    await saveGrades(x.teacher.id, x.offering.id, input("61", false), "", db);
    const part2 = await db.subject.create({ data: { careerId: x.career.id, name: "Programación I", level: 1, part: 2 } });
    const old = await db.offering.create({ data: { subjectId: part2.id, moduleId: x.module.id, teacherId: x.teacher.id, shift: "M" } });
    const history = await db.registration.create({ data: { enrollmentId: x.enrollment.id, offeringId: old.id, grade: "60", published: true } });
    const previousYear = await db.academicYear.create({ data: { year: x.year.year - 1 } });
    const previousEnrollment = await db.enrollment.create({ data: { studentId: x.student.id, yearId: previousYear.id, careerId: x.career.id, level: 1, shift: "M" } });
    await transferEnrollment(x.admin.id, x.enrollment.id, "N", "Solicitud", db);
    const moved = await db.registration.findUniqueOrThrow({ where: { id: x.row.id } });
    assert.equal(moved.offeringId, x.destination.id); assert.equal(moved.grade?.toString(), "61");
    assert.equal((await db.registration.findUniqueOrThrow({ where: { id: history.id } })).offeringId, old.id);
    assert.equal((await db.enrollment.findUniqueOrThrow({ where: { id: x.enrollment.id } })).shift, "N");
    assert.equal((await db.enrollment.findUniqueOrThrow({ where: { id: previousEnrollment.id } })).shift, "M");
  });
  test("destino faltante revierte todo el traslado", async () => {
    const part2 = await db.subject.create({ data: { careerId: x.career.id, name: "Programación I", level: 1, part: 2 } });
    const old = await db.offering.create({ data: { subjectId: part2.id, moduleId: x.module.id, teacherId: x.teacher.id, shift: "M" } });
    await db.registration.create({ data: { enrollmentId: x.enrollment.id, offeringId: old.id } });
    await assert.rejects(transferEnrollment(x.admin.id, x.enrollment.id, "N", "Solicitud", db), /Falta una oferta/);
    assert.equal((await db.enrollment.findUniqueOrThrow({ where: { id: x.enrollment.id } })).shift, "M");
    assert.equal((await db.registration.findUniqueOrThrow({ where: { id: x.row.id } })).offeringId, x.offering.id);
    assert.equal(await db.auditEvent.count(), 0);
  });
  test("versiones obsoletas y escrituras simultáneas no sobrescriben notas", async () => {
    await saveGrades(x.teacher.id, x.offering.id, input("61", false), "", db);
    await assert.rejects(saveGrades(x.teacher.id, x.offering.id, input("80", false), "", db), /planilla cambió/);
    const results = await Promise.allSettled([
      saveGrades(x.teacher.id, x.offering.id, input("70", false, 1), "", db),
      saveGrades(x.teacher.id, x.offering.id, input("80", false, 1), "", db),
    ]);
    assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
    assert.equal((await db.registration.findUniqueOrThrow({ where: { id: x.row.id } })).version, 2);
  });
  test("catálogos validan fechas, inscripción y privilegios; reset revoca sesiones", async () => {
    await assert.rejects(saveCatalog(x.admin.id, "modules", null, { yearId: x.year.id, number: 2, starts: "2026-02-30", ends: "2026-03-31" }, db));
    await assert.rejects(saveCatalog(x.admin.id, "registrations", null, { enrollmentId: x.enrollment.id, offeringId: x.destination.id }, db));
    await db.session.create({ data: { tokenHash: "a".repeat(64), userId: x.teacher.id, version: 0, expires: new Date(Date.now() + 3600000) } });
    await saveCatalog(x.admin.id, "users", x.teacher.id, { username: "teacher", ci: "7654321", role: "TEACHER", firstName: "Carlos", lastName: "Rojas", email: "", isActive: true, password: "CeicomNueva2026!" }, db);
    assert.equal(await db.session.count({ where: { userId: x.teacher.id } }), 0);
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: x.teacher.id } })).sessionVersion, 1);
    await assert.rejects(saveCatalog(x.admin.id, "users", x.admin.id, { username: "admin", role: "TEACHER", firstName: "Admin", lastName: "Prueba", email: "", isActive: false }, db));
  });
  test("importación conserva hashes, ids, decimales, auditoría y secuencias; rechaza destino ocupado", async () => {
    await clear();
    const pass = "TestingCeicom!2026", hash = "pbkdf2_sha256$1000$salt$" + pbkdf2Sync(pass, "salt", 1000, 32, "sha256").toString("base64");
    const fixture = [
      { model: "auth.user", pk: 50, fields: { username: "legacy", password: hash, first_name: "Ana", last_name: "López", email: "", is_active: true, is_superuser: true, is_staff: true, date_joined: "2026-01-01T00:00:00Z" } },
      { model: "academics.career", pk: 40, fields: { name: "Sistemas" } },
      { model: "academics.academicyear", pk: 20, fields: { year: 2026 } },
      { model: "academics.module", pk: 10, fields: { year: 20, number: 1, starts: "2026-01-01", ends: "2026-03-31" } },
      { model: "academics.subject", pk: 9, fields: { career: 40, name: "Programación", level: 1, part: 1 } },
      { model: "academics.student", pk: 8, fields: { user: 50, code: "OLD-1", entry_year: 2024, can_view_grades: false } },
      { model: "academics.enrollment", pk: 7, fields: { student: 8, year: 20, career: 40, level: 1, shift: "N" } },
      { model: "academics.offering", pk: 6, fields: { subject: 9, module: 10, teacher: 50, shift: "M" } },
      { model: "academics.registration", pk: 5, fields: { enrollment: 7, offering: 6, grade: "60.99", published: true } },
      { model: "academics.auditevent", pk: 4, fields: { actor: 50, action: "Histórico", details: "Sin modificar", created_at: "2026-01-01T10:30:00-04:00" } },
    ];
    const counts = await importDjango(fixture, db);
    assert.equal(counts["academics.registration"], 1);
    const user = await db.user.findUniqueOrThrow({ where: { id: 50 } });
    assert.equal(user.password, hash); assert.equal(await verifyPassword(pass, user.password), true);
    assert.equal((await db.registration.findUniqueOrThrow({ where: { id: 5 } })).grade?.toString(), "60.99");
    assert.equal((await db.student.findUniqueOrThrow({ where: { id: 8 } })).canViewGrades, false);
    assert.equal((await db.auditEvent.findUniqueOrThrow({ where: { id: 4 } })).details, "Sin modificar");
    assert.ok((await db.user.create({ data: { username: "new", password: "!" } })).id > 50);
    await assert.rejects(importDjango(fixture, db), /vacía/);
    await clear();
    await assert.rejects(importDjango([...fixture, { model: "academics.registration", pk: 99, fields: { enrollment: 7, offering: 6, grade: "101", published: true } }], db));
    assert.equal(await db.user.count(), 0);
  });
  test("registro único de estudiante crea cuenta y expediente con CI, rol y matrícula", async () => {
    const data = { ci: "1234567", firstName: "María", lastName: "Pérez", email: "", isActive: true, code: "CEI-2026-002", entryYear: 2026, role: "ADMIN" };
    const studentId = await savePerson(x.admin.id, "students", null, data, db);
    const student = await db.student.findUniqueOrThrow({ where: { id: studentId }, include: { user: true } });
    assert.equal(student.code, data.code); assert.equal(student.user.role, "STUDENT");
    assert.equal(student.user.isSuperuser, false); assert.equal(student.user.username, data.ci);
    assert.equal(student.user.ci, data.ci); assert.equal(student.user.mustChangePassword, true);
    assert.equal(await verifyPassword(data.ci, student.user.password), true);
    await assert.rejects(studentResults(student.userId, "", "", db));
    const count = await db.user.count();
    await assert.rejects(savePerson(x.admin.id, "students", null, { ...data, code: "NEW" }, db));
    await assert.rejects(savePerson(x.admin.id, "students", null, { ...data, ci: "9999999" }, db));
    assert.equal(await db.user.count(), count); // La matrícula duplicada no deja usuarios huérfanos.
  });
  test("rol docente existe antes de asignar materias y los cambios no borran el expediente", async () => {
    const teacherId = await savePerson(x.admin.id, "teachers", null, { ci: "2345678-1a", firstName: "José", lastName: "Rojas", email: "", isActive: true }, db);
    const teacher = await db.user.findUniqueOrThrow({ where: { id: teacherId } });
    assert.equal(teacher.role, "TEACHER"); assert.equal(teacher.ci, "2345678-1A"); assert.equal(teacher.username, "2345678-1A");
    assert.equal(await db.offering.count({ where: { teacherId } }), 0);
    await assert.rejects(savePerson(x.teacher.id, "teachers", null, { ci: "3345678", firstName: "No", lastName: "Autorizado", email: "", isActive: true }, db));
    await assert.rejects(savePerson(x.admin.id, "users", x.su.id, { role: "TEACHER", firstName: "Ana", lastName: "Pérez", email: "", isActive: true }, db));
    assert.equal(await db.enrollment.count({ where: { studentId: x.student.id } }), 1);
  });
  test("primer cambio elimina contraseña CI; cambiar usuario revoca sesiones y conserva CI y notas", async () => {
    const studentId = await savePerson(x.admin.id, "students", null, { ci: "3456789", firstName: "Ana", lastName: "Prueba", email: "", isActive: true, code: "S003", entryYear: 2026 }, db);
    const s = await db.student.findUniqueOrThrow({ where: { id: studentId } });
    await assert.rejects(updateOwnUsername(s.userId, "ana.nueva", "3456789", db));
    await assert.rejects(updateOwnPassword(s.userId, "incorrecta", "CeicomPersonal2026!", db));
    const changed = await updateOwnPassword(s.userId, "3456789", "CeicomPersonal2026!", db);
    assert.equal(changed.mustChangePassword, false);
    assert.equal(await verifyPassword("3456789", changed.password), false);
    assert.equal(await verifyPassword("CeicomPersonal2026!", changed.password), true);
    await db.session.create({ data: { tokenHash: "b".repeat(64), userId: s.userId, version: changed.sessionVersion, expires: new Date(Date.now() + 3600000) } });
    const renamed = await updateOwnUsername(s.userId, "ana.nueva", "CeicomPersonal2026!", db);
    assert.equal(renamed.username, "ana.nueva"); assert.equal(renamed.ci, "3456789");
    assert.equal(await db.session.count({ where: { userId: s.userId } }), 0);
    assert.equal((await db.student.findUniqueOrThrow({ where: { id: s.id } })).userId, s.userId);
    await assert.rejects(updateOwnUsername(s.userId, "teacher", "CeicomPersonal2026!", db));
    await assert.rejects(savePerson(x.admin.id, "teachers", null, { ci: "3456789", firstName: "CI", lastName: "Duplicado", email: "", isActive: true }, db));
  });

});
