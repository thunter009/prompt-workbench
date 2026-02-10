# AI Agent Instructions - Prompt Workbench

Instructions for AI coding assistants.

## Project Context

**Prompt Workbench** - Local web UI for prompt template editing with Raycast snippet sync

**Key facts:**
- Solo developer, no backward compatibility needed
- Uses pnpm (not npm)
- Local Supabase (Docker) for persistence
- Two-way sync with Raycast snippets (file watcher + interval)
- **Ollama for all AI features** (title inference, etc.) - no cloud AI APIs

## Session Setup (REQUIRED)

Before starting any work, register with agent mail for multi-agent coordination:

1. Call `macro_start_session` with:
   - `human_key`: `/Users/thom/10-19_projects/prompt-workbench`
   - `program`: your program name (e.g. `claude-code`)
   - `model`: your model name
   - `task_description`: brief description of current task
2. Note your assigned agent name from the response
3. Check inbox for messages from other agents before starting work
4. Periodically check inbox during long tasks to pick up coordination messages

This enables parallel ralph-tui loops to coordinate and avoid file conflicts.

## Critical Rules

### Code Style
- Use `@/*` path aliases for imports
- Named exports only (no default exports)
- Use `cn()` helper for conditional Tailwind
- Use `useReducer` when 3+ related state variables

### Simplicity Over Compatibility
- Prefer simplest solution even with breaking changes
- Delete legacy code freely

### No Fallbacks
- Never implement fallbacks unless explicitly instructed
- Throw errors for invalid data

### Documentation
- Details go in `/context/` - CLAUDE.md and AGENTS.md contain shallow pointers only

## Key Commands

```bash
pnpm dev          # Start dev server
pnpm build        # Production build
pnpm lint         # Lint code
npx tsc --noEmit  # Type check
```

## File Locations

| What | Where |
|------|-------|
| Pages | `/src/app/` |
| UI components | `/src/components/ui/` (shadcn) |
| Editor | `/src/components/editor/` |
| Raycast sync | `/src/lib/raycast/` |
| Sync engine | `/src/lib/sync/` (watcher, cron) |
| Supabase client | `/src/lib/supabase.ts` |
| Types | `/src/types/` |

## Raycast Placeholder Syntax

Support in editor highlighting/autocomplete:
- `{clipboard}`, `{clipboard offset=N}`
- `{cursor}`
- `{date}`, `{date format="..."}`, `{date offset="+Nd"}`
- `{time}`, `{datetime}`, `{day}`
- `{uuid}`, `{selection}`
- `{argument}`, `{argument name="..."}`
- `{snippet name="..."}`
- Modifiers: `uppercase`, `lowercase`, `trim`, `percent-encode`, `json-stringify`, `raw`

## Links
- [Architecture](concepts/architecture.md)
- [Raycast Integration](concepts/raycast-integration.md)
- [Data Models](concepts/data-models.md)
