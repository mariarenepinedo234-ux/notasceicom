import { passwordAction } from "@/app/actions";
import { Shell, PageTitle, Notice, type Query } from "@/components/ui";
export default async function Password({ searchParams }: { searchParams: Promise<Query> }) {
  return <Shell><PageTitle eyebrow="MI CUENTA" title="Cambiar contraseña" description="Al guardar se cerrarán las demás sesiones de tu cuenta." />
    <Notice query={await searchParams} /><section className="panel padded narrow"><form action={passwordAction}>
      <label>Contraseña actual<input name="currentPassword" type="password" autoComplete="current-password" maxLength={256} required /></label>
      <label>Nueva contraseña<input name="password" type="password" autoComplete="new-password" minLength={10} maxLength={256} required /></label>
      <label>Repite la nueva contraseña<input name="confirmPassword" type="password" autoComplete="new-password" minLength={10} maxLength={256} required /></label>
      <p className="muted">Usa al menos 10 caracteres, incluye letras y evita tu nombre de usuario.</p><button>Guardar contraseña</button>
    </form></section></Shell>;
}
