# PRD: Global Search (Cmd+P)

**Epic ID:** prompt-workbench-e7n
**Priority:** P1
**Status:** Draft

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
- [ ] Opens on Cmd+P (or Ctrl+P on Windows)
- [ ] Closes on Escape or click outside
- [ ] Input auto-focused on open
- [ ] Centered modal with backdrop blur
- [ ] Linear/Raycast-style aesthetic

### US-2: Fuzzy Search
**As a** user
**I want** to search by partial/fuzzy matches
**So that** I don't need exact names

**Acceptance Criteria:**
- [ ] Searches snippet name, content, keyword, tags
- [ ] Fuzzy matching (e.g., "prmpt" finds "prompt")
- [ ] Results ranked by relevance
- [ ] Highlights matched characters
- [ ] Max 20 results shown

### US-3: Keyboard Navigation
**As a** user
**I want** to navigate results with keyboard
**So that** I never need to use mouse

**Acceptance Criteria:**
- [ ] Arrow keys move selection
- [ ] Enter opens selected snippet
- [ ] Tab/Shift+Tab also navigates
- [ ] First result selected by default

### US-4: Recent Items
**As a** user
**I want** to see recent snippets when search is empty
**So that** I can quickly access what I was working on

**Acceptance Criteria:**
- [ ] Shows 5 most recent snippets when query empty
- [ ] "Recent" label above list
- [ ] Clears on typing

### US-5: Search in Folder
**As a** user
**I want** to scope search to current folder
**So that** I can narrow results

**Acceptance Criteria:**
- [ ] Checkbox/toggle: "Search in current folder"
- [ ] Shows folder name when scoped
- [ ] Remembers preference

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
