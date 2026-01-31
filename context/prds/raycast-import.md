# PRD: Raycast Import

**Priority:** P2
**Status:** Draft

## Problem Statement

Users have existing Raycast snippets they want to edit in Prompt Workbench. No import flow exists.

## Goal

Import Raycast snippets from file system or JSON file into the app.

## User Stories

### US-1: Import from JSON File
**As a** user
**I want** to import a Raycast JSON file
**So that** I can edit existing snippets

**Acceptance Criteria:**
- [ ] "Import from File" button in settings/menu
- [ ] File picker for JSON selection
- [ ] Parse and validate Raycast format
- [ ] Show preview before import
- [ ] Success toast with count imported

### US-2: Import from Raycast Directory
**As a** user
**I want** to import directly from Raycast's data folder
**So that** I don't need to export from Raycast first

**Acceptance Criteria:**
- [ ] Button to scan `~/Library/Application Support/Raycast/` (macOS)
- [ ] Auto-detect snippet files
- [ ] Handle permission errors gracefully
- [ ] Show list of found snippet collections

### US-3: Conflict Resolution
**As a** user
**I want** to handle duplicates during import
**So that** I don't lose existing work

**Acceptance Criteria:**
- [ ] Detect duplicates by name or keyword
- [ ] Options: Skip, Replace, Keep Both (rename)
- [ ] Bulk apply option for all conflicts
- [ ] Show diff for conflicting items

### US-4: Selective Import
**As a** user
**I want** to choose which snippets to import
**So that** I only get what I need

**Acceptance Criteria:**
- [ ] Preview list with checkboxes
- [ ] Select all / Deselect all
- [ ] Show snippet preview on hover/click
- [ ] Import only selected items

### US-5: Import to Folder
**As a** user
**I want** to import into a specific folder
**So that** snippets stay organized

**Acceptance Criteria:**
- [ ] Folder selector during import
- [ ] Option to create new folder
- [ ] Default to root if not specified

## Technical Notes

- Raycast snippet format: `[{name, text, keyword?}]`
- Raycast data location varies by version
- API endpoint: `POST /api/raycast/import` for file parsing
- Client-side File System Access API for directory picking
- Store import history/timestamps

## API Design

```typescript
// POST /api/raycast/import
interface ImportRequest {
  snippets: RaycastSnippet[]
  targetFolderId?: string
  conflictResolution: 'skip' | 'replace' | 'keep-both'
}

interface ImportResponse {
  imported: number
  skipped: number
  errors: { name: string; reason: string }[]
}
```

## UI Components

- ImportDialog: Modal with file picker, preview, conflict resolution
- ImportPreview: List of snippets to import with checkboxes
- ConflictResolver: Side-by-side diff view

## Dependencies

- Raycast export feature (completed)
- File System Access API support
- Supabase snippet storage

## Out of Scope

- Real-time sync with Raycast
- Windows/Linux Raycast paths (Raycast macOS-only)
- Importing from other tools (Alfred, Espanso)
