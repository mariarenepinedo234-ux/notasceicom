import { test } from "node:test";
import assert from "node:assert/strict";
import { pbkdf2Sync } from "node:crypto";
import { hashPassword, validatePassword, verifyPassword } from "../src/lib/password";
test("contraseñas nuevas y credenciales incorrectas", async () => {
  const hash = await hashPassword("TestingCeicom!2026");
  assert.equal(await verifyPassword("TestingCeicom!2026", hash), true);
  assert.equal(await verifyPassword("incorrecta", hash), false);
  assert.equal(await verifyPassword("x", "!unusable"), false);
  assert.equal(await verifyPassword("x", "pbkdf2_sha256$0$salt$abc"), false);
  assert.throws(() => validatePassword("123456789012"));
  assert.throws(() => validatePassword("short"));
  assert.throws(() => validatePassword("MiUsuario2026!", "miusuario"));
});
test("verifica contraseñas PBKDF2 de Django sin reescribirlas", async () => {
  const password = "TestingCeicom!2026", salt = "djangoSalt2026";
  for (const digest of ["sha256", "sha1"]) {
    const hash = "pbkdf2_" + digest + "$1000$" + salt + "$" + pbkdf2Sync(password, salt, 1000, digest === "sha256" ? 32 : 20, digest).toString("base64");
    assert.equal(await verifyPassword(password, hash), true);
    assert.equal(await verifyPassword("incorrecta", hash), false);
  }
});
