import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { displayName, shiftName, shifts } from "@/lib/rules";
import { transferAction } from "@/app/actions";
import { Notice, PageTitle, Shell, type Query } from "@/components/ui";
export default async function Transfer({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Query> }) {
  await requireAdmin();
  const p = await params;
  if (!/^[1-9]\d*$/.test(p.id) || !Number.isSafeInteger(Number(p.id))) notFound();
  const e = await db.enrollment.findUnique({ where: { id: Number(p.id) }, include: { student: { include: { user: true } }, career: true, year: true } });
  if (!e) notFound();
  return <Shell><Link href="/" className="back">← Volver al panel</Link><PageTitle eyebrow="TRASLADO DE TURNO"
    title={displayName(e.student.user)} description={e.career.name + " · " + e.year.year + " · Turno actual: " + shiftName(e.shift)} />
    <Notice query={await searchParams} /><section className="panel padded narrow"><h2>Cambiar turno</h2>
      <p>Las notas publicadas conservan su turno original. Las inscripciones sin publicar, con sus borradores, se trasladan a ofertas de la misma materia, parte y módulo.</p>
      <p>Si falta alguna oferta de destino, se rechaza el traslado completo.</p><form action={transferAction}><input type="hidden" name="enrollmentId" value={e.id} />
        <label>Turno de destino<select aria-label="Turno de destino" name="shift" required defaultValue=""><option value="" disabled>Selecciona un turno</option>
          {Object.entries(shifts).filter(([key]) => key !== e.shift).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>Motivo<textarea name="reason" maxLength={4000} rows={3} required /></label><button>Registrar traslado</button>
      </form></section></Shell>;
}
