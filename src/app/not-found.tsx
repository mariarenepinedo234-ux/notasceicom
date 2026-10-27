import Link from "next/link";
export default function NotFound() {
  return <main className="standalone"><div className="eyebrow">CEICOM · 404</div><h1>No encontramos esta página.</h1>
    <p>Comprueba el enlace o vuelve a tu panel.</p><Link className="button" href="/">Volver al panel</Link></main>;
}
