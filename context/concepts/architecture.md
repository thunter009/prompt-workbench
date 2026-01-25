# Architecture Overview

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 (App Router) |
| UI | React 19, TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Editor | CodeMirror 6 |
| Database | Local Supabase (Docker) |
| State | Zustand |
| Sync | chokidar + node-cron |

## High-Level Structure

```
┌─────────────────────────────────────────┐
│         Next.js App Router              │
│  (Server & Client Components)           │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│         Main Editor View                │
│  - Sidebar (folders, search, tags)      │
│  - Editor (CodeMirror + placeholders)   │
│  - Preview (live markdown render)       │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│      Local Supabase (Docker)            │
│  - snippets, folders, versions          │
│  - RLS policies for future multi-user   │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│      Sync Engine                        │
│  - File watcher (chokidar)              │
│  - Interval backup (node-cron)          │
│  - Export: Generate JSON                │
│  - Import: Parse .rayconfig             │
└─────────────────────────────────────────┘
```

## Directory Structure

```
/src
├── app/                   # Next.js App Router pages
│   ├── page.tsx           # Main editor view
│   └── api/               # API routes
│       ├── snippets/      # CRUD
│       └── sync/          # Raycast sync
│
├── components/
│   ├── ui/                # shadcn/ui base
│   ├── editor/            # CodeMirror wrapper
│   ├── sidebar/           # Folders, search, tags
│   └── preview/           # Live markdown render
│
├── lib/
│   ├── supabase.ts        # Supabase client init
│   ├── raycast/           # Import/export logic
│   └── sync/              # Sync engine
│       ├── watcher.ts     # chokidar file watcher
│       ├── scheduler.ts   # node-cron interval
│       └── engine.ts      # Diff, merge, conflict detection
│
├── hooks/                 # Custom React hooks
└── types/                 # TypeScript definitions
```

## Data Flow

```
Component
  ↓
Zustand Store
  ↓
Supabase Client (@supabase/supabase-js)
  ↓
Local Supabase (Docker)
```

## Sync Flow

```
┌─────────────────┐     ┌─────────────────┐
│ File Watcher    │     │ Interval Cron   │
│ (chokidar)      │     │ (node-cron)     │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     ↓
           ┌─────────────────┐
           │   Sync Engine   │
           │ - Diff detection│
           │ - Conflict UI   │
           └────────┬────────┘
                    ↓
           ┌─────────────────┐
           │ Raycast Export  │
           │ (JSON file)     │
           └─────────────────┘
```

## Key Patterns

### Linear-style UX
- Full-width editor, minimal chrome
- Cmd+K command palette (cmdk)
- Keyboard-first navigation
- Split pane: editor | preview

### State Management
- Zustand for UI state
- React Query for server state (if needed)
- Local-first: Supabase (Docker) is source of truth
