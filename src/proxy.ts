import { NextRequest, NextResponse } from "next/server";
// Refuerza la verificación de origen de Server Actions también para POST sin identificador de acción.
export function proxy(request: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return NextResponse.next();
  const origin = request.headers.get("origin");
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host"))?.split(",")[0].trim();
  try {
    if (!origin || !host || new URL(origin).host !== host) return new NextResponse("Origen no autorizado.", { status: 403 });
  } catch { return new NextResponse("Origen no autorizado.", { status: 403 }); }
  return NextResponse.next();
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
