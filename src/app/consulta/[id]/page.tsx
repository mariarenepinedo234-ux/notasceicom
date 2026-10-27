import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { displayName } from "@/lib/rules";
import { visibilityAction } from "@/app/actions";
import { Notice, PageTitle, Shell, type Query } from "@/components/ui";
export default async function Visibility({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Query> }) {
  await requireAdmin();
  const p = await params;
  if (!/^[1-9]\d*$/.test(p.id) || !Number.isSafeInteger(Number(p.id))) notFound();
  const student = await db.student.findUnique({ where: { id: Number(p.id) }, include: { user: true } });
  if (!student) notFound();
  return <Shell><Link href="/" className="back">← Volver al panel</Link><PageTitle eyebrow="CONSULTA DE NOTAS"
    title={displayName(student.user)} description={student.code + " · Consulta " + (student.canViewGrades ? "habilitada" : "restringida")} />
    <Notice query={await searchParams} /><section className="panel padded narrow"><h2>{student.canViewGrades ? "Restringir" : "Habilitar"} consulta</h2>
      <p>Este cambio afecta únicamente a la consulta. Conserva las notas y el acceso a la cuenta.</p><form action={visibilityAction}>
        <input type="hidden" name="studentId" value={student.id} /><input type="hidden" name="enabled" value={String(!student.canViewGrades)} />
        <label>Motivo<textarea name="reason" maxLength={4000} rows={3} required /></label>
        <button>{student.canViewGrades ? "Restringir consulta" : "Habilitar consulta"}</button></form></section></Shell>;
}
