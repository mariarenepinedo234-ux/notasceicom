import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { roleLabels } from "@/lib/people";
import { accountAction } from "@/app/actions";
import { Notice, PageTitle, Shell, type Query } from "@/components/ui";
export default async function Account({ searchParams }: { searchParams: Promise<Query> }) {
  const user = await requireUser();
  return <Shell><PageTitle eyebrow="MI CUENTA" title="Mis datos de acceso" description="Puedes cambiar tu usuario y contraseña sin modificar tu carnet ni tu expediente." />
    <Notice query={await searchParams} /><section className="panel padded narrow">
      <h2>{user.firstName} {user.lastName}</h2><p>{roleLabels[user.isSuperuser ? "ADMIN" : user.role]} · CI: {user.ci ?? "Pendiente de registrar por administración"}</p>
      <form action={accountAction}><label>Nuevo usuario<input name="username" defaultValue={user.username} required maxLength={150} autoComplete="username" /></label>
        <label>Contraseña actual<input name="currentPassword" type="password" required maxLength={256} autoComplete="current-password" /></label>
        <p className="muted">Al guardar se cerrarán las demás sesiones. La próxima vez entrarás con el nuevo usuario.</p><button>Guardar usuario</button></form>
      <Link className="back" href="/password">Cambiar contraseña →</Link></section></Shell>;
}
