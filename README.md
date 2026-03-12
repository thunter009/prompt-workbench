# prompt-workbench

## Local environments

- `pnpm dev` - normal local workspace (`~/.prompt-workbench/data.db`)
- `pnpm dev:e2e` - isolated test workspace (`~/.prompt-workbench/e2e/data.db`)
- `pnpm test:e2e` - Playwright tests against isolated e2e workspace
- `pnpm cleanup:test-snippets -- --apply` - backup + remove common e2e snippet noise from main workspace DB
