import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "CEICOM · Registro académico", description: "Gestión y consulta del historial académico del Instituto Tecnológico CEICOM." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="es"><body>{children}</body></html>;
}
