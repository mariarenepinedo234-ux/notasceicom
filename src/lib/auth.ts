import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { db } from "./db";
const cookieName = "ceicom_session";
export function tokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }
export async function currentUser() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await db.session.findUnique({ where: { tokenHash: tokenHash(token) }, include: { user: true } });
  if (!session || session.expires <= new Date() || !session.user.isActive ||
      session.version !== session.user.sessionVersion) return null;
  const { password: _password, ...user } = session.user;
  return user;
}
export async function requireUser(options: { allowTemporary?: boolean } = {}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword && !options.allowTemporary) redirect("/password");
  return user;
}
export async function requireAdmin() {
  const user = await requireUser();
  if (!user.isSuperuser) notFound();
  return user;
}
export async function createSession(user: { id: number; sessionVersion: number }) {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const previous = (await cookies()).get(cookieName)?.value;
  if (previous) await db.session.deleteMany({ where: { tokenHash: tokenHash(previous) } });
  await db.session.create({ data: { tokenHash: tokenHash(token), userId: user.id, version: user.sessionVersion, expires } });
  (await cookies()).set(cookieName, token, { httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: "/", expires });
}
export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: tokenHash(token) } });
  jar.delete(cookieName);
}
