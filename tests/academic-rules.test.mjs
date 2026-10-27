import test from 'node:test';
import assert from 'node:assert/strict';
import { validGrade, gradeStatus, thirdWeekdayAfter } from '../prototipo/academic-rules.mjs';

test('el mínimo es 1, el máximo 100 y se aprueba desde 61', () => {
  for (const value of [1, 60, 61, 100]) assert.equal(validGrade(value), true);
  for (const value of [0, -1, 101, NaN, Infinity, null, '61']) assert.equal(validGrade(value), false);
  assert.equal(gradeStatus(60), 'Reprobado');
  assert.equal(gradeStatus(61), 'Aprobado');
  assert.equal(gradeStatus(null), 'Pendiente');
  assert.throws(() => gradeStatus(0), RangeError);
});

test('cuenta tres días posteriores y excluye fines de semana', () => {
  assert.equal(thirdWeekdayAfter('2026-03-30'), '2026-04-02'); // Lunes → jueves
  assert.equal(thirdWeekdayAfter('2026-03-31'), '2026-04-03'); // No omite feriados sin regla confirmada
  assert.equal(thirdWeekdayAfter('2026-04-03'), '2026-04-08'); // Viernes → miércoles
  assert.equal(thirdWeekdayAfter('2026-04-04'), '2026-04-08'); // Sábado → miércoles
  assert.equal(thirdWeekdayAfter('2026-04-05'), '2026-04-08'); // Domingo → miércoles
  assert.equal(thirdWeekdayAfter('2026-12-31'), '2027-01-05');
  assert.equal(thirdWeekdayAfter('2028-02-28'), '2028-03-02'); // Año bisiesto
});

test('rechaza fechas inexistentes y entradas incompletas', () => {
  for (const date of ['', '2026-02-30', '2026-13-01', 'viernes']) {
    assert.throws(() => thirdWeekdayAfter(date), RangeError);
  }
});
