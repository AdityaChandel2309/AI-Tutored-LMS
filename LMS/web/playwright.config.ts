import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:3001",
    trace: "retain-on-failure",
    channel: undefined,
    launchOptions: {
      executablePath: "/usr/bin/chromium-browser",
    },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  webServer: [
    {
      command: "npm run start:prod",
      cwd: "../api",
      url: "http://127.0.0.1:3000/",
      reuseExistingServer: true,
      timeout: 120000,
    },
    {
      command: "npm run start -- --hostname 127.0.0.1 --port 3001",
      cwd: ".",
      url: "http://127.0.0.1:3001/",
      reuseExistingServer: true,
      timeout: 120000,
    },
  ],
});
