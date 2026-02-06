# PRD: Version History

**Epic ID:** prompt-workbench-70a
**Priority:** P2
**Status:** 🟡 Partially Complete (US-1, US-2 done; US-3, US-4, US-5 remaining)

## Problem Statement

Users edit prompts iteratively but have no way to see previous versions, compare changes, or restore earlier work. Risk of losing good iterations.

## Goal

Auto-save snippet versions with browsable history, visual diffs, and one-click restore.

## User Stories

### US-1: Auto-save on Edit ✅
**As a** user
**I want** versions saved automatically as I edit
**So that** I never lose work

**Acceptance Criteria:**
- [x] Save version after 2s of inactivity (debounced)
- [x] Don't save if content unchanged
- [x] Store in Supabase `snippet_versions` table
- [x] Max 100 versions per snippet (prune oldest)

**Related issue:** prompt-workbench-8ei

### US-2: Version History Sidebar ✅
**As a** user
**I want** to browse previous versions in a sidebar
**So that** I can see how a snippet evolved

**Acceptance Criteria:**
- [x] "History" tab/panel in sidebar or drawer
- [x] List versions with timestamp + preview
- [x] Click to view version content (read-only)
- [x] Shows relative time ("2 hours ago")

**Related issue:** prompt-workbench-57b

### US-3: Diff View
**As a** user
**I want** to see differences between versions
**So that** I can understand what changed

**Acceptance Criteria:**
- [ ] Side-by-side or inline diff view
- [ ] Highlights additions (green) and deletions (red)
- [ ] Compare: current vs selected, or any two versions
- [ ] Line-level granularity

**Related issue:** prompt-workbench-02m

### US-4: One-click Restore
**As a** user
**I want** to restore a previous version instantly
**So that** I can recover from mistakes

**Acceptance Criteria:**
- [ ] "Restore" button on each version
- [ ] Confirmation dialog with preview
- [ ] Creates new version from restore (doesn't delete history)
- [ ] Keyboard shortcut: Cmd+Z for recent, Cmd+Shift+Z for history

**Related issue:** prompt-workbench-efv

### US-5: Version Cleanup
**As a** user
**I want** to delete old versions manually
**So that** I can reduce clutter

**Acceptance Criteria:**
- [ ] "Delete version" option (with confirmation)
- [ ] "Keep only last N versions" bulk action
- [ ] Cannot delete current version

## Technical Notes

- Use `snippet_versions` table (already in schema)
- Diff library: `diff` or `jsdiff`
- Debounce with `useDebouncedCallback`
- Virtual scroll for long history lists

## Dependencies

- Depends on: Supabase schema (completed)
- Blocks: None

## Out of Scope

- Branching/forking versions
- Collaborative editing history
- Version comments/annotations
