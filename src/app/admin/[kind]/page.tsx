import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { catalogNames, isCatalog } from "@/lib/catalog";
import { catalogView } from "@/lib/catalog-ui";
import { catalogAction } from "@/app/actions";
import { Notice, PageTitle, queryValue, Shell, type Query } from "@/components/ui";
function fieldValue(value: unknown, type: string | undefined) {
  if (value instanceof Date) return type === "date" ? value.toISOString().slice(0, 10) : new Date(value.getTime() - 4 * 3600000).toISOString().slice(0, 16);
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}
export default async function Catalog({ params, searchParams }: { params: Promise<{ kind: string }>; searchParams: Promise<Query> }) {
  await requireAdmin();
  const { kind } = await params;
  if (!isCatalog(kind)) notFound();
  const query = await searchParams, view = await catalogView(kind);
  const editId = queryValue(query, "edit");
  const editing = view.editable && /^\d+$/.test(editId) ? view.rows.find(r => r.id === Number(editId)) : undefined;
  if (editId && !editing) notFound();
  return <Shell><Link href="/admin" className="back">← Catálogos y usuarios</Link><PageTitle eyebrow="ADMINISTRACIÓN" title={catalogNames[kind]}
    description={view.editable ? "Crea y actualiza los registros institucionales." : "Las altas conservan un expediente estable. Los cambios de notas, consulta y turno tienen sus propias acciones."} />
    <Notice query={query} /><div className="catalog-layout"><section className="panel"><div className="panel-head"><h2>Registros <span className="count">{view.rows.length}</span></h2></div>
      {view.rows.map(r => <div className="module" key={r.id}><div><h3>{r.title}</h3><p>{r.detail}</p><small>#{r.id}</small></div><div className="actions">
        {view.editable && <Link href={"/admin/" + kind + "?edit=" + r.id}>Editar →</Link>}
        {kind === "students" && <Link href={"/consulta/" + r.id}>Cambiar consulta →</Link>}
        {kind === "enrollments" && <Link href={"/traslado/" + r.id}>Cambiar turno →</Link>}
        {kind === "offerings" && <Link href={"/materia/" + r.id}>Abrir planilla →</Link>}
        {kind === "registrations" && <Link href={"/materia/" + r.values.offeringId}>Abrir planilla →</Link>}
      </div></div>)}
      {!view.rows.length && <div className="empty">Aún no hay registros en este catálogo.</div>}</section>
      <section className="panel padded catalog-form"><h2>{editing ? "Editar #" + editing.id : "Nuevo registro"}</h2>
        <form action={catalogAction} key={editing?.id ?? "new"}><input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="recordId" value={editing?.id ?? ""} />
          {view.fields.map(field => {
            const raw = editing?.values[field.name], current = fieldValue(raw, field.type);
            const frozen = Boolean(editing && field.immutable);
            return <label key={field.name} className={field.type === "checkbox" ? "checkbox-label" : ""}>{field.label}
              {frozen && <input type="hidden" name={field.name} value={current} />}
              {field.options ? <select name={field.name} defaultValue={current} required={field.required} disabled={frozen}>
                <option value="" disabled>Selecciona una opción</option>{field.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select> :
                field.type === "textarea" ? <textarea name={field.name} defaultValue={current} required={field.required} maxLength={field.maxLength} rows={3} /> :
                field.type === "checkbox" ? <input name={field.name} type="checkbox" defaultChecked={editing ? Boolean(raw) : field.name === "isActive"} /> :
                <input name={field.name} type={field.type ?? "text"} defaultValue={field.type === "password" ? "" : current} required={field.required}
                  min={field.min} max={field.max} maxLength={field.maxLength} readOnly={frozen} autoComplete={field.type === "password" ? "new-password" : "off"} />}
            </label>;
          })}
          {kind === "users" && <p className="muted">El docente se asigna a una oferta. El estudiante se vincula a un expediente. Restablecer una contraseña cierra sus sesiones.</p>}
          <button>{editing ? "Guardar cambios" : "Crear registro"}</button>
          {editing && <Link className="back" href={"/admin/" + kind}>Cancelar edición</Link>}
        </form></section></div></Shell>;
}
