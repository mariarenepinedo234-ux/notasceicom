"use client";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="standalone"><div className="eyebrow">CEICOM</div><h1>No se pudo completar la solicitud.</h1>
    <p>Revisa tu acceso y vuelve a intentarlo. Si el problema continúa, comunícate con administración.</p>
    <button onClick={reset}>Intentar otra vez</button><a className="back" href="/">Volver al panel</a></main>;
}
