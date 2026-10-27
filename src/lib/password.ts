import { pbkdf2, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { invariant } from "./rules";
const pbkdf2Async = promisify(pbkdf2);
function derive(password: string, salt: string, length = 64) {
  return new Promise<Buffer>((resolve, reject) => scrypt(password, salt, length,
    { N: 16384, r: 8, p: 1 }, (err, key) => err ? reject(err) : resolve(key)));
}
export function validatePassword(password: string, username = "") {
  invariant(password.length >= 10 && password.length <= 256, "Usa una contraseña de 10 a 256 caracteres.");
  invariant(!/^\d+$/.test(password), "La contraseña no puede contener solo números.");
  invariant(!username || !password.toLowerCase().includes(username.toLowerCase()),
    "La contraseña no debe contener el nombre de usuario.");
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return "scrypt$" + salt + "$" + (await derive(password, salt)).toString("base64");
}
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  if (password.length > 256) return false;
  try {
    const parts = encoded.split("$");
    let key: Buffer;
    let expected: Buffer;
    if (parts[0] === "scrypt" && parts.length === 3) {
      key = await derive(password, parts[1]);
      expected = Buffer.from(parts[2], "base64");
    } else if ((parts[0] === "pbkdf2_sha256" || parts[0] === "pbkdf2_sha1") && parts.length === 4) {
      const iterations = Number(parts[1]);
      if (!Number.isInteger(iterations) || iterations < 1 || iterations > 10_000_000) return false;
      const digest = parts[0] === "pbkdf2_sha256" ? "sha256" : "sha1";
      key = await pbkdf2Async(password, parts[2], iterations, digest === "sha256" ? 32 : 20, digest);
      expected = Buffer.from(parts[3], "base64");
    } else return false; // Contraseñas Django inutilizables permanecen bloqueadas.
    return key.length === expected.length && timingSafeEqual(key, expected);
  } catch { return false; }
}
