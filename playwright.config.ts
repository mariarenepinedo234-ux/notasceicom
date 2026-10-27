import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e", workers: 1, retries: 0,
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  webServer: { command: "npm run start", url: "http://localhost:3000/login", reuseExistingServer: false, timeout: 120000 },
  reporter: [["list"], ["html", { open: "never" }]],
});
