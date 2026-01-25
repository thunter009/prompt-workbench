# CLAUDE.md

Instructions for Claude Code on Prompt Workbench.

## Start of Session

**Read `openspec.yaml` for project overview, then:**
1. `/context/AGENTS.md` - AI-specific rules
2. `/context/README.md` - Documentation index
3. Wait for user to specify task

**Task workflow:** User specifies task. Read task file, execute it, update status.

## Task Management (Beads)

```bash
bd ready                              # View available work
bd show <id>                          # View issue details
bd update <id> --status in_progress   # Start work
bd close <id>                         # Complete work
```

## Quick Reference

### Commands
```bash
pnpm install          # Install deps
pnpm dev              # Dev server (http://localhost:3000)
pnpm build            # Production build
pnpm lint             # Lint
npx tsc --noEmit      # Type check
```

### Key Locations
| What | Where |
|------|-------|
| Pages | `/src/app/` |
| Components | `/src/components/` |
| Editor | `/src/components/editor/` |
| Raycast sync | `/src/lib/raycast/` |
| Sync engine | `/src/lib/sync/` |
| Supabase | `/src/lib/supabase.ts` |
| Context docs | `/context/` |

## Critical Rules

### Code Style
- Use `@/*` path aliases
- Named exports only
- Use `cn()` for conditional Tailwind
- Use `useReducer` for 3+ related state

### Simplicity
- Solo dev - no backward compat
- Prefer simple solutions with breaking changes
- Delete legacy code freely

### Documentation
- Details go in `/context/` - CLAUDE.md contains shallow pointers only

## Full Documentation
| Topic | Location |
|-------|----------|
| **Project Spec** | `openspec.yaml` |
| **Index** | `/context/README.md` |
| **AI Instructions** | `/context/AGENTS.md` |
| **Architecture** | `/context/concepts/architecture.md` |
| **Raycast Integration** | `/context/concepts/raycast-integration.md` |
