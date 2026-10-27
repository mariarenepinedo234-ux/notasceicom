import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { accessibleOffering } from "@/lib/academic";
import { canEdit, deadlineFor, displayName, id, localTime, result, shiftName } from "@/lib/rules";
import { gradebookAction } from "@/app/actions";
import { Notice, PageTitle, Shell, type Query } from "@/components/ui";
export default async function Gradebook({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Query> }) {
  const actor = await requireUser(), p = await params;
  if (!/^[1-9]\d*$/.test(p.id)) notFound();
  const offering = await accessibleOffering(actor, id(p.id));
  if (!offering) notFound();
  const editable = canEdit(actor, offering);
  const rows = await db.registration.findMany({ where: { offeringId: offering.id },
    include: { enrollment: { include: { student: { include: { user: true } } } } },
    orderBy: { enrollment: { student: { code: "asc" } } } });
  return <Shell><Link href="/" className="back">← Volver al panel</Link><PageTitle eyebrow="PLANILLA ACADÉMICA"
    title={offering.subject.name + " · Parte " + offering.subject.part}
    description={offering.subject.career.name + " · " + offering.module.year.year + " / Módulo " + offering.module.number + " · " + shiftName(offering.shift)} />
    <Notice query={await searchParams} />
    <div className="notice">Fin del módulo: {offering.module.ends.toISOString().slice(0, 10)} · Cierre exclusivo: {localTime(deadlineFor(offering.module.ends))} (Bolivia).
      Se excluyen sábados y domingos; los feriados no están configurados.</div>
    {!editable && <div className="notice error"><strong>Plazo de carga finalizado.</strong> Solicita una autorización excepcional a administración.</div>}
    <section className="panel"><div className="panel-head"><div><h2>Registro de notas</h2><p>1 a 100 · Aprobación desde 61 · Vacío significa pendiente.</p></div>
      <a className="button secondary" href={"/planilla/" + offering.id}>Descargar CSV ↓</a></div>
      <form action={gradebookAction}><input type="hidden" name="offeringId" value={offering.id} />
        <fieldset disabled={!editable}><div className="table-wrap"><table><thead><tr><th>Estudiante</th><th>Nota / 100</th><th>Publicar</th><th>Estado</th></tr></thead><tbody>
          {rows.map(r => { const locked = r.published && !actor.isSuperuser; return <tr key={r.id}><td><strong>{displayName(r.enrollment.student.user)}</strong><small>{r.enrollment.student.code}</small>
            <input type="hidden" name={"version_" + r.id} value={r.version} /></td>
            <td><input className="grade-input" aria-label={"Nota de " + r.enrollment.student.code} name={"grade_" + r.id}
              type="number" min="1" max="100" step="0.01" defaultValue={r.grade?.toString() ?? ""} disabled={locked} /></td>
            <td><input aria-label={"Publicar nota de " + r.enrollment.student.code} type="checkbox" name={"publish_" + r.id} defaultChecked={r.published} disabled={locked} /></td>
            <td><span className={"tag " + (!r.published ? "draft" : "")}>{r.published ? "Publicada · " + result(r.grade) : "Borrador"}</span></td></tr>; })}
          {!rows.length && <tr><td colSpan={4}>No hay estudiantes inscritos. Administración debe inscribirlos en esta oferta.</td></tr>}
        </tbody></table></div>
        {actor.isSuperuser && <div className="padded"><label>Motivo de corrección<textarea name="reason" maxLength={4000} rows={2} placeholder="Obligatorio al cambiar una nota publicada." /></label></div>}
        <div className="module"><small>Al publicar, el estudiante puede consultar la nota. Después, las correcciones requieren administración.</small>
          {editable && <button>Guardar notas</button>}</div></fieldset></form>
    </section></Shell>;
}
