import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { loginAction } from "@/app/actions";
import { Logo, Notice, type Query } from "@/components/ui";
export default async function Login({ searchParams }: { searchParams: Promise<Query> }) {
  if (await currentUser()) redirect("/");
  return <div className="login-page"><section className="login-intro"><Logo /><div><div className="eyebrow">REGISTRO ACADÉMICO</div>
    <h1>Tu trayectoria,<br />en un solo lugar.</h1><p>Un espacio para aprender, acompañar y construir tu futuro.</p></div>
    <small>Instituto Tecnológico CEICOM</small></section><main className="login-form"><div><div className="eyebrow">BIENVENIDO A CEICOM</div>
      <h2>Ingresa a tu cuenta</h2><p>Accede con tus credenciales institucionales.</p><Notice query={await searchParams} />
      <form action={loginAction}><label>Usuario<input name="username" autoComplete="username" maxLength={150} required /></label>
        <label>Contraseña<input name="password" type="password" autoComplete="current-password" maxLength={256} required /></label>
        <button type="submit">Iniciar sesión <span>→</span></button></form><p className="muted">Si necesitas recuperar tu acceso, comunícate con administración.</p>
    </div></main></div>;
}
