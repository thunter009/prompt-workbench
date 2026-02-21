import { defineConfig } from 'drizzle-kit'
import { isAbsolute, join, resolve } from 'path'
import { homedir } from 'os'

const configuredPath = process.env.PROMPT_WORKBENCH_DB_PATH?.trim()
const dbPath = !configuredPath
  ? join(homedir(), '.prompt-workbench', 'data.db')
  : configuredPath.startsWith('~/')
    ? join(homedir(), configuredPath.slice(2))
    : isAbsolute(configuredPath)
      ? configuredPath
      : resolve(process.cwd(), configuredPath)

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  dialect: 'sqlite',
  dbCredentials: {
    url: dbPath,
  },
})
