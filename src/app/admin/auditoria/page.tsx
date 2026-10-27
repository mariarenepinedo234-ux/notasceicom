import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { displayName, localTime } from "@/lib/rules";
import { PageTitle, Shell, queryValue, type Query } from "@/components/ui";
export default async function Audit({ searchParams }: { searchParams: Promise<Query> }) {
  await requireAdmin();
  const q = await searchParams, raw = queryValue(q, "page");
  const page = /^\d{1,6}$/.test(raw) ? Math.max(1, Number(raw)) : 1, limit = 50;
  const [events, count] = await Promise.all([
    db.auditEvent.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], include: { actor: true }, skip: (page - 1) * limit, take: limit }),
    db.auditEvent.count(),
  ]);
  return <Shell><Link href="/admin" className="back">← Catálogos y usuarios</Link><PageTitle eyebrow="TRAZABILIDAD"
    title="Auditoría" description="Historial de cambios, autores, motivos y fechas. Los eventos son de solo lectura." />
    <section className="panel"><div className="panel-head"><h2>{count} movimientos</h2><span>Página {page}</span></div>
      <div className="table-wrap"><table><thead><tr><th>Fecha / autor</th><th>Acción</th><th>Detalle</th></tr></thead><tbody>
        {events.map(e => <tr key={e.id}><td>{localTime(e.createdAt)}<small>{displayName(e.actor)}</small></td><td>{e.action}</td><td>{e.details}</td></tr>)}
        {!events.length && <tr><td colSpan={3}>No hay movimientos en esta página.</td></tr>}
      </tbody></table></div><div className="panel-head">{page > 1 && <Link href={"?page=" + (page - 1)}>← Anterior</Link>}
        {page * limit < count && <Link href={"?page=" + (page + 1)}>Siguiente →</Link>}</div></section></Shell>;
}
