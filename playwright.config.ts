import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:3002',
    headless: true,
  },
  webServer: {
    command: 'PROMPT_WORKBENCH_DB_PATH=.prompt-workbench-e2e.db npm run db:push && PROMPT_WORKBENCH_DB_PATH=.prompt-workbench-e2e.db PW_ENABLE_TEST_API=1 pnpm dev --port 3002',
    port: 3002,
    reuseExistingServer: false,
    timeout: 60000,
  },
})
