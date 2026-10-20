import { defineConfig } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export default defineConfig({
  testDir: "./tests",
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:8001",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    launchOptions: {
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
        : {}),
      args: JSON.parse(process.env.PLAYWRIGHT_LAUNCH_ARGS || "[]"),
    },
  },
  webServer: {
    command:
      "python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8001",
    cwd: "..",
    url: "http://127.0.0.1:8001/api/health",
    reuseExistingServer: false,
    env: {
      LATENTSPACE_DATA_DIR: mkdtempSync(join(tmpdir(), "latentspace-e2e-")),
    },
    timeout: 30000,
  },
});
