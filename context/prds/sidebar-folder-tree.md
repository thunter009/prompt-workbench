# PRD: Sidebar Folder Tree

**Epic ID:** prompt-workbench-ep0
**Priority:** P1
**Status:** ❌ Not Started (flat list only, no tree structure)

## Problem Statement

Flat snippet list doesn't scale. Need hierarchical folder organization with drag-drop.

## Goal

Collapsible folder tree in sidebar with drag-drop for snippets and folders.

## User Stories

### US-1: Folder Data Model & Tree Display
**As a** user
**I want** folders displayed as expandable tree
**So that** I can organize snippets hierarchically

**Acceptance Criteria:**
- [ ] Folder type in Zustand store (`id`, `name`, `parentId`, `order`)
- [ ] Snippets get optional `folderId` field
- [ ] Folders render as collapsible tree with chevrons
- [ ] Nested folders indented
- [ ] Snippet count per folder
- [ ] "Unfiled" section for snippets without folder

### US-2: Create & Manage Folders
**As a** user
**I want** to create, rename, and delete folders
**So that** I can organize my work

**Acceptance Criteria:**
- [ ] "New Folder" button in sidebar header
- [ ] Inline rename on creation and double-click
- [ ] Can create nested folders (max 3 levels)
- [ ] Delete folder: confirm if non-empty, move contents to parent
- [ ] Persist folder state to localStorage

### US-3: Drag-Drop Snippets into Folders
**As a** user
**I want** to drag snippets into folders
**So that** I can organize without menus

**Acceptance Criteria:**
- [ ] Drag snippet onto folder to move it
- [ ] Visual drop target highlighting
- [ ] Drop on sidebar root = unfiled

### US-4: Drag-Drop Folder Reordering
**As a** user
**I want** to reorder and nest folders via drag
**So that** I can customize structure

**Acceptance Criteria:**
- [ ] Drag folder to reorder among siblings
- [ ] Drag folder into folder to nest (max 3 levels)
- [ ] Prevents circular nesting

### US-5: Collapse State Persistence
**As a** user
**I want** folder open/closed state to persist
**So that** I don't re-expand every session

**Acceptance Criteria:**
- [ ] Expanded folder IDs stored in localStorage
- [ ] Restored on page load

## Technical Notes

- Use `@dnd-kit/core` + `@dnd-kit/sortable` for drag-drop
- Tree state in Zustand, persisted to localStorage

## Dependencies

- Depends on: Zustand store (completed)
- Blocks: Auto-Organize Snippets (prompt-workbench-843)

## Out of Scope

- Folder colors/icons
- Shared folders
- Virtual scrolling (premature — unlikely to hit 100+ folders)
- Supabase sync (local-only for now)
- Multi-select drag
- Undo (Cmd+Z)
