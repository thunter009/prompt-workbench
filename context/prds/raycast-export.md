# PRD: Raycast Export

**Epic ID:** prompt-workbench-0s6
**Priority:** P1
**Status:** Draft

## Problem Statement

Users create/edit snippets in the app but need to get them into Raycast. No automated export flow exists.

## Goal

One-click export to Raycast-compatible JSON with validation and sync tracking.

## User Stories

### US-1: Export All Snippets
**As a** user
**I want** to export all snippets to Raycast JSON
**So that** I can import them into Raycast

**Acceptance Criteria:**
- [ ] "Export to Raycast" button in toolbar/menu
- [ ] Generates valid Raycast JSON format
- [ ] Saves to `~/Downloads/raycast-snippets.json` (or chosen location)
- [ ] Success toast with file path

### US-2: Export Selection
**As a** user
**I want** to export only selected snippets
**So that** I can do partial updates

**Acceptance Criteria:**
- [ ] Multi-select snippets in sidebar
- [ ] Right-click > "Export Selected"
- [ ] Only exports selected items
- [ ] Shows count in confirmation

### US-3: Export Folder
**As a** user
**I want** to export an entire folder
**So that** I can share organized collections

**Acceptance Criteria:**
- [ ] Right-click folder > "Export Folder"
- [ ] Includes all nested snippets
- [ ] Option to include/exclude subfolders

### US-4: Validation Before Export
**As a** user
**I want** validation errors shown before export
**So that** I don't export broken snippets

**Acceptance Criteria:**
- [ ] Checks: name present, text present, char limit (65,536)
- [ ] Shows list of issues with links to fix
- [ ] Blocks export if critical errors
- [ ] Warnings for non-critical (e.g., no keyword)

### US-5: Export Tracking
**As a** user
**I want** to know which snippets were exported
**So that** I can track what's in Raycast

**Acceptance Criteria:**
- [ ] "Last exported" timestamp per snippet
- [ ] Visual indicator for "not exported" / "modified since export"
- [ ] Filter: "Show unexported"

### US-6: Quick Export Path
**As a** user
**I want** to set a default export location
**So that** exports go to same place

**Acceptance Criteria:**
- [ ] Settings: Default export path
- [ ] "Export to default" one-click action
- [ ] Keyboard shortcut: Cmd+Shift+E

## Technical Notes

- Raycast JSON format: `[{name, text, keyword?}]`
- Use File System Access API or electron-like save dialog
- Store export timestamps in Supabase
- Validate against Raycast constraints

## Dependencies

- Depends on: Zustand store (completed), snippet schema
- Blocks: Two-way sync

## Out of Scope

- Direct Raycast API integration (doesn't exist)
- Auto-import into Raycast
- Export to other formats (Alfred, etc.)
