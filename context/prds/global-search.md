# PRD: Global Search (Cmd+P)

**Epic ID:** prompt-workbench-e7n
**Priority:** P1
**Status:** ✅ Complete

## Problem Statement

Users have many snippets and need fast access. No way to quickly find snippets by content, name, or keyword without scrolling through sidebar.

## Goal

Linear/VSCode-style fuzzy search palette accessible via Cmd+P.

## User Stories

### US-1: Search Palette UI
**As a** user
**I want** a search modal that appears on Cmd+P
**So that** I can quickly find any snippet

**Acceptance Criteria:**
- [x] Opens on Cmd+P (or Ctrl+P on Windows)
- [x] Closes on Escape or click outside
- [x] Input auto-focused on open
- [x] Centered modal with backdrop blur
- [x] Linear/Raycast-style aesthetic

### US-2: Fuzzy Search
**As a** user
**I want** to search by partial/fuzzy matches
**So that** I don't need exact names

**Acceptance Criteria:**
- [x] Searches snippet name, content, keyword, tags
- [x] Fuzzy matching (e.g., "prmpt" finds "prompt")
- [x] Results ranked by relevance
- [x] Highlights matched characters
- [x] Max 20 results shown

### US-3: Keyboard Navigation
**As a** user
**I want** to navigate results with keyboard
**So that** I never need to use mouse

**Acceptance Criteria:**
- [x] Arrow keys move selection
- [x] Enter opens selected snippet
- [x] Tab/Shift+Tab also navigates
- [x] First result selected by default

### US-4: Recent Items
**As a** user
**I want** to see recent snippets when search is empty
**So that** I can quickly access what I was working on

**Acceptance Criteria:**
- [x] Shows 5 most recent snippets when query empty
- [x] "Recent" label above list
- [x] Clears on typing

### US-5: Search in Folder
**As a** user
**I want** to scope search to current folder
**So that** I can narrow results

**Acceptance Criteria:**
- [x] Checkbox/toggle: "Search in current folder" (shows "All folders" filter)
- [x] Shows folder name when scoped
- [x] Remembers preference

## Technical Notes

- Use `cmdk` (Command Menu) library
- Fuse.js for fuzzy search
- Index snippets in Zustand for fast access
- Debounce search (50ms)

## Dependencies

- Depends on: Zustand store (completed)
- Blocks: None (Cmd+K command palette is separate feature)

## Out of Scope

- Full-text search in versions
- Regex search
- Search and replace
