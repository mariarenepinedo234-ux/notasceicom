export function validGrade(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 100;
}

export function gradeStatus(value) {
  if (value === null) return 'Pendiente';
  if (!validGrade(value)) throw new RangeError('La nota debe estar entre 1 y 100.');
  return value >= 61 ? 'Aprobado' : 'Reprobado';
}

// Cálculo por fecha, sin depender de la zona horaria del navegador.
// Cuenta tres días completos posteriores al fin; omite sábados y domingos.
// No define la hora de corte ni excluye feriados: ambas reglas están pendientes.
export function thirdWeekdayAfter(endDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) throw new RangeError('Fecha inválida.');
  const date = new Date(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== endDate) {
    throw new RangeError('Fecha inválida.');
  }
  let remaining = 3;
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) remaining--;
  }
  return date.toISOString().slice(0, 10);
}
