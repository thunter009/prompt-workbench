import { defineConfig } from 'drizzle-kit'
import { join } from 'path'
import { homedir } from 'os'

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  dialect: 'sqlite',
  dbCredentials: {
    url: join(homedir(), '.prompt-workbench', 'data.db'),
  },
})
