import Link from "next/link";
import Image from "next/image";
import { requireUser } from "@/lib/auth";
import { displayName } from "@/lib/rules";
import { logoutAction } from "@/app/actions";
export type Query = Record<string, string | string[] | undefined>;
export function queryValue(q: Query, key: string) { const v = q[key]; return typeof v === "string" ? v : ""; }
export function Notice({ query }: { query: Query }) {
  const error = queryValue(query, "error"), success = queryValue(query, "success");
  return <>{error && <div role="alert" className="notice error">{error}</div>}
    {success && <div role="status" className="notice success">{success}</div>}</>;
}
export function Logo() {
  return <Image className="institution-logo" src="/brand/ceicom-logo.png" alt="Instituto Tecnológico Ceicom" width={1881} height={836} priority />;
}
export async function Shell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <div className="app">
    <aside><Link href="/" className="brand"><Logo /></Link><div className="aside-label">REGISTRO ACADÉMICO</div>
      <nav aria-label="Navegación principal"><Link href="/">Panel principal <span>↗</span></Link>
        {user.isSuperuser && <><Link href="/admin">Catálogos y usuarios</Link><Link href="/admin/auditoria">Auditoría</Link></>}
        <Link href="/password">Cambiar contraseña</Link></nav>
      <div className="aside-bottom"><div className="avatar">{displayName(user).slice(0, 1)}</div><strong>{displayName(user)}</strong>
        <small>{user.isSuperuser ? "Administración" : "Mi cuenta"}</small><form action={logoutAction}><button className="text-button">Cerrar sesión →</button></form></div>
    </aside>
    <div className="workspace"><header><span>Instituto Tecnológico CEICOM</span><span className="institution-tag">Portal académico</span></header>
      <main>{children}</main><footer>CEICOM · Registro académico <span>Hora institucional: Bolivia (UTC−04)</span></footer></div>
  </div>;
}
export function PageTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return <div className="page-title"><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>;
}
export function Empty({ children }: { children: React.ReactNode }) { return <div className="empty">{children}</div>; }
