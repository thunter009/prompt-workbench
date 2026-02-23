import { defineConfig } from '@playwright/test'

const E2E_PORT = 3002

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    headless: true,
  },
  webServer: {
    command: 'pnpm run db:e2e:reset && pnpm run db:push:e2e && pnpm run dev:e2e',
    port: E2E_PORT,
    reuseExistingServer: false,
    timeout: 60000,
  },
})
