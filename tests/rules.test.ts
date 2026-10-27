import { test } from "node:test";
import assert from "node:assert/strict";
import { canEdit, csvCell, dateOnly, deadlineFor, parseGrade, result } from "../src/lib/rules";
test("plazo: tres días hábiles completos en Bolivia, omite fines de semana y cruza de gestión", () => {
  assert.equal(deadlineFor("2026-04-03").toISOString(), "2026-04-09T04:00:00.000Z");
  assert.equal(deadlineFor("2026-12-31").toISOString(), "2027-01-06T04:00:00.000Z");
  assert.throws(() => dateOnly("2026-02-30"));
});
test("el cierre y las reaperturas son exclusivos y no autorizan a otro docente", () => {
  const o = { teacherId: 2, module: { ends: dateOnly("2026-04-03") }, extensions: [] as { until: Date }[] };
  const teacher = { id: 2, isSuperuser: false }, admin = { id: 1, isSuperuser: true };
  const limit = deadlineFor(o.module.ends);
  assert.equal(canEdit(teacher, o, new Date(limit.getTime() - 1)), true);
  assert.equal(canEdit(teacher, o, limit), false);
  o.extensions.push({ until: new Date(limit.getTime() + 3600000) });
  assert.equal(canEdit(teacher, o, limit), true);
  assert.equal(canEdit(teacher, o, o.extensions[0].until), false);
  assert.equal(canEdit({ id: 3, isSuperuser: false }, o, limit), false);
  assert.equal(canEdit(admin, o, o.extensions[0].until), true);
});
test("notas sin redondeo implícito, vacío pendiente y aprobación por parte", () => {
  for (const invalid of ["0", "101", "NaN", "Infinity", "61.123", "-1", "1e2", "1,5"])
    assert.throws(() => parseGrade(invalid));
  assert.equal(parseGrade(""), null); assert.equal(parseGrade("61.10"), "61.10");
  assert.equal(parseGrade("1"), "1.00"); assert.equal(parseGrade("100"), "100.00");
  assert.equal(result(null), "Pendiente"); assert.equal(result("60.99"), "Reprobado");
  assert.equal(result("61"), "Aprobado");
});
test("CSV neutraliza fórmulas y escapa comillas, saltos y comas", () => {
  assert.equal(csvCell("=MALICIOUS()"), "\"'=MALICIOUS()\"");
  assert.equal(csvCell('Ana, "López"'), '"Ana, ""López"""');
  assert.equal(csvCell("\t=1"), "\"'\t=1\"");
  assert.equal(csvCell(null), '""');
});
