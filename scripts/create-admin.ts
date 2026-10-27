import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { invariant } from "../src/lib/rules";
import { hashPassword, validatePassword } from "../src/lib/password";
async function main() {
  const username = process.env.CEICOM_ADMIN_USER?.trim(), password = process.env.CEICOM_ADMIN_PASSWORD;
  invariant(username && /^[\p{L}\p{N}_.@+\-]{1,150}$/u.test(username) && password, "Configura CEICOM_ADMIN_USER y CEICOM_ADMIN_PASSWORD.");
  validatePassword(password, username);
  const db = new PrismaClient();
  try {
    await db.user.create({ data: { username, password: await hashPassword(password), isActive: true, isSuperuser: true, isStaff: true, role: "ADMIN" } });
    console.log("Administrador creado. Elimina las variables temporales de contraseña.");
  } finally { await db.$disconnect(); }
}
main().catch(e => { console.error(e instanceof Error ? e.message : "No se pudo crear el administrador."); process.exitCode = 1; });
