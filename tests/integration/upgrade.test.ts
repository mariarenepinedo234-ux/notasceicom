import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
const url = process.env.DATABASE_URL;
assert.ok(url && new URL(url).pathname.endsWith("_test") && process.env.CEICOM_TEST_DB === "1", "Usa una base de pruebas aislada.");
test("actualizar v0.2 conserva contraseñas y expedientes y deduce roles existentes", async () => {
  const db = new PrismaClient();
  const schema = "upgrade_" + randomBytes(8).toString("hex");
  const initial = await readFile("prisma/migrations/202610270001_initial/migration.sql", "utf8");
  const upgrade = await readFile("prisma/migrations/202610270002_people_roles/migration.sql", "utf8");
  try {
    await db.$transaction(async tx => {
      await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
      for (const statement of initial.split(";").map(s => s.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement);
      await tx.$executeRawUnsafe(`INSERT INTO "User" ("username", "password", "isSuperuser") VALUES ('admin_old','old_admin_hash',true), ('teacher_old','old_teacher_hash',false), ('student_old','old_student_hash',false)`);
      await tx.$executeRawUnsafe(`INSERT INTO "Student" ("userId","code","entryYear") VALUES (3,'OLD-001',2024)`);
      for (const statement of upgrade.split(";").map(s => s.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement);
      const users = await tx.$queryRawUnsafe<{ username: string; password: string; role: string; ci: string | null; mustChangePassword: boolean }[]>(`SELECT "username", "password", "role"::text, "ci", "mustChangePassword" FROM "User" ORDER BY "id"`);
      assert.deepEqual(users.map(u => u.role), ["ADMIN", "TEACHER", "STUDENT"]);
      assert.deepEqual(users.map(u => u.password), ["old_admin_hash", "old_teacher_hash", "old_student_hash"]);
      assert.ok(users.every(u => u.ci === null && !u.mustChangePassword));
      const students = await tx.$queryRawUnsafe<{ code: string; entryYear: number }[]>(`SELECT "code","entryYear" FROM "Student"`);
      assert.deepEqual(students, [{ code: "OLD-001", entryYear: 2024 }]);
      await tx.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    }, { timeout: 20000 });
  } finally { await db.$disconnect(); }
});
