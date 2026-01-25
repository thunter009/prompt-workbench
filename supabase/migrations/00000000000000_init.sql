-- Initial schema migration for Prompt Workbench
-- Creates core tables for snippets, folders, versions, and sync settings

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Folders table (must be created first for foreign key reference)
CREATE TABLE folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Snippets table
CREATE TABLE snippets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  text TEXT NOT NULL,
  keyword TEXT,
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  version INTEGER DEFAULT 1,
  raycast_synced_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ  -- soft delete
);

-- Version history for snippets
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

-- Indexes for common queries
CREATE INDEX idx_snippets_folder ON snippets(folder_id);
CREATE INDEX idx_snippets_updated ON snippets(updated_at DESC);
CREATE INDEX idx_snippets_deleted ON snippets(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_snippets_keyword ON snippets(keyword) WHERE keyword IS NOT NULL;
CREATE INDEX idx_versions_snippet ON snippet_versions(snippet_id);
CREATE INDEX idx_folders_parent ON folders(parent_id);

-- Full-text search index for snippets
CREATE INDEX idx_snippets_search ON snippets
  USING GIN (to_tsvector('english', name || ' ' || text));

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_snippets_updated_at
  BEFORE UPDATE ON snippets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default sync settings row
INSERT INTO sync_settings (id, watcher_enabled, interval_enabled, interval_minutes)
VALUES (gen_random_uuid(), true, true, 30);

-- Comments for documentation
COMMENT ON TABLE snippets IS 'Prompt snippets with Raycast sync support';
COMMENT ON TABLE folders IS 'Hierarchical folder organization for snippets';
COMMENT ON TABLE snippet_versions IS 'Version history for auto-save and rollback';
COMMENT ON TABLE sync_settings IS 'User preferences for Raycast sync behavior';
COMMENT ON COLUMN snippets.keyword IS 'Raycast keyword trigger for quick expansion';
COMMENT ON COLUMN snippets.raycast_synced_at IS 'Last successful sync with Raycast snippets file';
COMMENT ON COLUMN snippets.deleted_at IS 'Soft delete timestamp, NULL means active';
