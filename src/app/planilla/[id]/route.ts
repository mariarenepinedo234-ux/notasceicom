import { currentUser } from "@/lib/auth";
import { accessibleOffering } from "@/lib/academic";
import { db } from "@/lib/db";
import { csvCell, displayName, result, shiftName } from "@/lib/rules";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await currentUser();
  if (!actor) return new Response("Inicia sesión.", { status: 401 });
  const { id } = await context.params;
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) return new Response("No encontrada.", { status: 404 });
  const o = await accessibleOffering(actor, Number(id));
  if (!o) return new Response("No encontrada.", { status: 404 });
  const rows = await db.registration.findMany({ where: { offeringId: o.id },
    include: { enrollment: { include: { student: { include: { user: true } } } } },
    orderBy: { enrollment: { student: { code: "asc" } } } });
  const data: unknown[][] = [["Código", "Estudiante", "Carrera", "Materia", "Parte", "Gestión", "Módulo", "Turno", "Nota", "Resultado", "Publicada"]];
  for (const r of rows) data.push([r.enrollment.student.code, displayName(r.enrollment.student.user), o.subject.career.name,
    o.subject.name, o.subject.part, o.module.year.year, o.module.number, shiftName(o.shift), r.grade?.toString() ?? "",
    result(r.grade), r.published ? "Sí" : "No"]);
  return new Response("\uFEFF" + data.map(r => r.map(csvCell).join(",")).join("\r\n") + "\r\n", { headers: {
    "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="ceicom-planilla-' + o.id + '.csv"',
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
  } });
}
