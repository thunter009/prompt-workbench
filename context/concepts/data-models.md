# Data Models

## Database Schema (Supabase/PostgreSQL)

```sql
-- Snippets table
CREATE TABLE snippets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  text TEXT NOT NULL,
  keyword TEXT,
  folder_id UUID REFERENCES folders(id),
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  version INTEGER DEFAULT 1,
  raycast_synced_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ  -- soft delete
);

-- Folders table
CREATE TABLE folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES folders(id),
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Version history
CREATE TABLE snippet_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snippet_id UUID NOT NULL REFERENCES snippets(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sync settings (user preferences)
CREATE TABLE sync_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watcher_enabled BOOLEAN DEFAULT true,
  interval_enabled BOOLEAN DEFAULT true,
  interval_minutes INTEGER DEFAULT 30,
  last_sync_at TIMESTAMPTZ,
  raycast_path TEXT DEFAULT '~/Library/Application Support/Raycast/'
);

-- Indexes
CREATE INDEX idx_snippets_folder ON snippets(folder_id);
CREATE INDEX idx_snippets_updated ON snippets(updated_at DESC);
CREATE INDEX idx_versions_snippet ON snippet_versions(snippet_id);
```

## TypeScript Types

```typescript
interface Snippet {
  id: string
  name: string
  text: string
  keyword?: string
  folderId?: string
  tags: string[]
  createdAt: number
  updatedAt: number
  version: number
  raycastSyncedAt?: number
}

interface Folder {
  id: string
  name: string
  parentId?: string
  orderIndex: number
}

interface SnippetVersion {
  id: string
  snippetId: string
  text: string
  createdAt: number
}

// Raycast export format
interface RaycastSnippet {
  name: string
  text: string
  keyword?: string
}
```

## Zustand Store

```typescript
interface SnippetStore {
  snippets: Snippet[]
  folders: Folder[]
  selectedId: string | null
  searchQuery: string

  // Actions
  selectSnippet: (id: string) => void
  createSnippet: (data: Partial<Snippet>) => Promise<Snippet>
  updateSnippet: (id: string, data: Partial<Snippet>) => Promise<void>
  deleteSnippet: (id: string) => Promise<void>
  search: (query: string) => void
}
```
