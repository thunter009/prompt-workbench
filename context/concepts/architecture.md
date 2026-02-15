# Architecture Overview

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 (App Router) |
| UI | React 19, TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Editor | CodeMirror 6 |
| Database | SQLite (`~/.prompt-workbench/data.db`) via better-sqlite3 + drizzle-orm |
| State | Zustand |
| Sync | Raycast export/import |

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
│    Zustand Stores (client state)        │
│  - Hydrate from API on mount            │
│  - Fire-and-forget writes to API        │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│    Next.js API Routes (/api/db/*)       │
│  - snippets, folders, versions          │
│  - settings (key-value), playground     │
│  - sync-history                         │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│    SQLite (better-sqlite3 + drizzle)    │
│  - ~/.prompt-workbench/data.db          │
│  - WAL mode, singleton connection       │
└─────────────────────────────────────────┘
```

## Directory Structure

```
/src
├── app/                   # Next.js App Router pages
│   ├── page.tsx           # Main editor view
│   └── api/
│       ├── db/            # SQLite CRUD routes
│       └── sync/          # Raycast sync
│
├── components/
│   ├── ui/                # shadcn/ui base
│   ├── editor/            # CodeMirror wrapper
│   ├── sidebar/           # Folders, search, tags
│   └── preview/           # Live markdown render
│
├── lib/
│   ├── db/
│   │   ├── schema.ts      # Drizzle table definitions
│   │   ├── connection.ts  # Singleton DB connection
│   │   ├── queries.ts     # Shared query functions
│   │   └── client.ts      # Typed fetch wrapper for stores
│   ├── store.ts           # Main snippet store (Zustand)
│   ├── version-store.ts   # Version history store
│   ├── raycast/           # Import/export logic
│   └── sync/              # Sync engine
│
├── hooks/                 # Custom React hooks
└── types/                 # TypeScript definitions
```

## Data Flow

```
Component
  ↓
Zustand Store (hydrate on mount, optimistic updates)
  ↓
dbClient (fire-and-forget fetch calls)
  ↓
API Route (/api/db/*)
  ↓
Drizzle ORM → SQLite
```

## Sync Flow

```
┌─────────────────┐
│ Manual Trigger   │
│ or Interval Sync │
└────────┬────────┘
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
- Zustand stores start empty, hydrate from SQLite via API on mount
- Writes are fire-and-forget (optimistic) — SQLite is <1ms, API ~5ms
- Settings stored as key-value pairs in `settings` table (JSON values)
- `theme` kept in localStorage (next-themes needs pre-hydration)
- Panel layout kept in localStorage (react-resizable-panels needs sync storage)

### Auto-Migration
- On first load: detect localStorage data + empty DB → migrate to SQLite → clear localStorage
