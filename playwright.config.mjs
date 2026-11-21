import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  testMatch: "**/*.spec.mjs",
  timeout: 65000,
  workers: 2,
  use: {
    baseURL: "http://127.0.0.1:4173/apogee/",
    browserName: "chromium",
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined },
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1360, height: 900 } } },
    {
      name: "phone-portrait",
      use: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "phone-landscape",
      use: {
        viewport: { width: 844, height: 390 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: "node scripts/preview.mjs",
    url: "http://127.0.0.1:4173/apogee/",
    reuseExistingServer: !process.env.CI,
  },
});
