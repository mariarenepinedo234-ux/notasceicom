import { test, expect, type Page } from "@playwright/test";
async function login(page: Page, username: string) {
  await page.goto("/login");
  await page.getByLabel("Usuario", { exact: true }).fill(username);
  await page.getByLabel("Contraseña", { exact: true }).fill("CeicomDemo2026!");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/$/);
}
test("autenticación, borrador, publicación, consulta propia y permisos", async ({ page }) => {
  await page.goto("/"); await expect(page).toHaveURL(/\/login/);
  await login(page, "docente_demo");
  const active = page.locator(".module").filter({ hasText: "Módulo 4" }).filter({ hasText: "Mañana" });
  await active.getByRole("link", { name: "Abrir planilla" }).click();
  await page.getByLabel("Nota de CEI-DEMO-001").fill("83.25");
  await page.getByRole("button", { name: "Guardar notas" }).click();
  await expect(page.getByRole("status")).toContainText("Notas guardadas");
  await expect(page.getByLabel("Nota de CEI-DEMO-001")).toHaveValue("83.25");
  await page.getByLabel("Publicar nota de CEI-DEMO-001").check();
  await page.getByRole("button", { name: "Guardar notas" }).click();
  await expect(page.getByLabel("Nota de CEI-DEMO-001")).toBeDisabled();
  await page.getByRole("link", { name: "Descargar CSV" }).click({ noWaitAfter: true });
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await login(page, "estudiante_demo");
  await expect(page.getByRole("heading", { name: "Mi historial académico" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "83.25 / 100" })).toBeVisible();
  await page.getByLabel("Módulo", { exact: true }).selectOption("1");
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(page.getByRole("cell", { name: "83.25 / 100" })).toHaveCount(0);
  const denied = await page.request.get("/planilla/1");
  expect(denied.status()).toBe(404);
  const admin = await page.request.get("/admin");
  expect(admin.status()).toBe(404);
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await login(page, "admin_demo");
  await page.getByRole("link", { name: "Restringir consulta", exact: true }).click();
  await page.getByLabel("Motivo", { exact: true }).fill("Prueba de restricción");
  await page.getByRole("button", { name: "Restringir consulta", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Cambios guardados");
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await login(page, "estudiante_demo");
  await expect(page.getByRole("heading", { name: "Consulta de notas temporalmente suspendida" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "83.25 / 100" })).toHaveCount(0);
});
test("sesión HTTP segura y formulario con origen ajeno rechazado", async ({ page, context }) => {
  await login(page, "admin_demo");
  const cookies = await context.cookies();
  const cookie = cookies.find(c => c.name === "ceicom_session");
  expect(cookie?.httpOnly).toBe(true); expect(cookie?.secure).toBe(true); expect(cookie?.sameSite).toBe("Lax");
  await page.goto("/password");
  const hidden = await page.locator('form:has(input[name="currentPassword"]) input[type="hidden"]').evaluateAll(
    nodes => Object.fromEntries(nodes.map(n => [(n as HTMLInputElement).name, (n as HTMLInputElement).value])));
  const response = await page.request.post("/password", {
    headers: { Origin: "https://untrusted.example", "Content-Type": "application/x-www-form-urlencoded" },
    form: { ...hidden, currentPassword: "CeicomDemo2026!", password: "OtraClave2026!", confirmPassword: "OtraClave2026!" },
  });
  expect([400, 403, 500]).toContain(response.status());
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await login(page, "admin_demo"); // El cambio de origen ajeno no se aplicó.
});
test("catálogos y navegación móvil conservan acceso a las funciones", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "admin_demo");
  await page.getByRole("link", { name: "Catálogos y usuarios", exact: true }).first().click();
  await page.getByRole("link", { name: /Carreras/ }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Administración de Empresas");
  await page.getByRole("button", { name: "Crear registro" }).click();
  await expect(page.getByRole("heading", { name: "Administración de Empresas", exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Cambios guardados");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
