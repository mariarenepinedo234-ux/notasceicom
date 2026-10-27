import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { catalogNames } from "@/lib/catalog";
import { PageTitle, Shell } from "@/components/ui";
export default async function Administration() {
  await requireAdmin();
  return <Shell><PageTitle eyebrow="ADMINISTRACIÓN" title="Catálogos y usuarios" description="Crea primero los catálogos y luego las matrículas, ofertas e inscripciones." />
    <div className="catalog-grid">{Object.entries(catalogNames).map(([key, label], index) => <Link className="catalog-card" key={key} href={"/admin/" + key}>
      <small>{String(index + 1).padStart(2, "0")}</small><h2>{label}</h2><span>Administrar →</span></Link>)}
      <Link className="catalog-card" href="/admin/auditoria"><small>HISTORIAL</small><h2>Auditoría</h2><span>Ver movimientos →</span></Link></div>
  </Shell>;
}
