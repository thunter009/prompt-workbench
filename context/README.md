# Context Directory - Prompt Workbench

Single source of truth for AI coding agents and human developers.

## Quick Navigation

| Need | Go to |
|------|-------|
| **First time setup** | [playbooks/local-setup.md](playbooks/local-setup.md) |
| **System architecture** | [concepts/architecture.md](concepts/architecture.md) |
| **Raycast integration** | [concepts/raycast-integration.md](concepts/raycast-integration.md) |
| **Data models** | [concepts/data-models.md](concepts/data-models.md) |
| **Code conventions** | [guidelines/code-style.md](guidelines/code-style.md) |
| **Current tasks** | `br ready` (beads_rust CLI) |
| **AI instructions** | [AGENTS.md](AGENTS.md) |

## Directory Structure

```
context/
├── README.md              ← You are here
├── AGENTS.md              ← AI-specific instructions
│
├── concepts/              ← Canonical, stable knowledge
│   ├── architecture.md    # System design
│   ├── raycast-integration.md # Sync mechanics
│   └── data-models.md     # TypeScript types & DB schema
│
├── guidelines/            ← Standards & conventions
│   ├── code-style.md      # Formatting, imports
│   ├── commit-conventions.md
│   └── task-management.md # beads CLI
│
└── playbooks/             ← Step-by-step procedures
    ├── local-setup.md     # First-time setup
    └── raycast-sync.md    # Import/export workflow
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 (App Router) |
| UI | React 19, Tailwind CSS, shadcn/ui |
| Editor | CodeMirror 6 |
| Database | Local Supabase (Docker) |
| State | Zustand |
| Sync | chokidar (watcher) + node-cron (interval) |
| Package Manager | pnpm |
