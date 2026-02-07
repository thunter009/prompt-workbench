import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:3002',
    headless: true,
  },
  webServer: {
    command: 'pnpm dev --port 3002',
    port: 3002,
    reuseExistingServer: true,
    timeout: 60000,
  },
})
