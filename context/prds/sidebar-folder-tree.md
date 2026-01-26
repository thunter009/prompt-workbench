# PRD: Sidebar Folder Tree

**Epic ID:** prompt-workbench-ep0
**Priority:** P1
**Status:** Draft

## Problem Statement

Users need to organize prompts into folders. Current flat list doesn't scale. Need hierarchical organization with drag-drop.

## Goal

Collapsible folder tree in sidebar with drag-drop reordering and nesting.

## User Stories

### US-1: Folder Tree Display
**As a** user
**I want** folders displayed as expandable tree
**So that** I can organize snippets hierarchically

**Acceptance Criteria:**
- [ ] Folders show expand/collapse chevron
- [ ] Nested folders indented
- [ ] Snippet count shown per folder
- [ ] Empty folders show "No snippets"

### US-2: Create Folder
**As a** user
**I want** to create new folders
**So that** I can organize my work

**Acceptance Criteria:**
- [ ] "New Folder" button in sidebar header
- [ ] Right-click context menu option
- [ ] Inline rename on creation
- [ ] Can create nested folders

### US-3: Drag-Drop Snippets
**As a** user
**I want** to drag snippets into folders
**So that** I can organize without menus

**Acceptance Criteria:**
- [ ] Drag snippet to folder to move it
- [ ] Visual feedback on valid drop targets
- [ ] Supports multi-select drag
- [ ] Undo via Cmd+Z

### US-4: Drag-Drop Folders
**As a** user
**I want** to reorder and nest folders
**So that** I can customize structure

**Acceptance Criteria:**
- [ ] Drag folder to reorder siblings
- [ ] Drag folder into folder to nest
- [ ] Max 3 levels deep
- [ ] Prevents circular nesting

### US-5: Folder Operations
**As a** user
**I want** to rename and delete folders
**So that** I can maintain organization

**Acceptance Criteria:**
- [ ] Double-click to rename inline
- [ ] Right-click > Delete
- [ ] Confirm delete if contains snippets
- [ ] Option to move contents or delete all

### US-6: Collapse State Persistence
**As a** user
**I want** folder open/closed state to persist
**So that** I don't re-expand every session

**Acceptance Criteria:**
- [ ] Stores expanded folder IDs in localStorage
- [ ] Restores on page load
- [ ] "Collapse All" / "Expand All" buttons

## Technical Notes

- Use `@dnd-kit/core` for drag-drop
- Tree state in Zustand
- Optimistic updates, sync to Supabase
- Virtual scrolling if >100 items

## Dependencies

- Depends on: Zustand store (completed)
- Blocks: None

## Out of Scope

- Folder colors/icons
- Shared folders
- Folder templates
