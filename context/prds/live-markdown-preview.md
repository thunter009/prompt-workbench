# PRD: Live Markdown Preview

**Epic ID:** prompt-workbench-dc2
**Priority:** P1
**Status:** Draft

## Problem Statement

Users write markdown in prompts but can't see how it renders. Need real-time preview that handles Raycast placeholders gracefully.

## Goal

Live preview pane that renders markdown and highlights Raycast placeholders.

## User Stories

### US-1: Basic Markdown Rendering
**As a** user
**I want** my markdown to render in real-time
**So that** I can verify formatting as I type

**Acceptance Criteria:**
- [ ] Renders headings, lists, code blocks, links
- [ ] Updates within 100ms of typing (debounced)
- [ ] Handles large documents without lag
- [ ] GFM (GitHub Flavored Markdown) support

### US-2: Placeholder Visualization
**As a** user
**I want** Raycast placeholders shown distinctly in preview
**So that** I can identify dynamic content

**Acceptance Criteria:**
- [ ] Placeholders rendered as styled pills/badges
- [ ] Shows placeholder type (clipboard, date, argument, etc.)
- [ ] Tooltip with full syntax on hover
- [ ] Nested snippets show reference name

### US-3: Placeholder Value Preview
**As a** user
**I want** to see example values for placeholders
**So that** I can understand what output looks like

**Acceptance Criteria:**
- [ ] Toggle: "Show example values"
- [ ] `{date}` shows today's date
- [ ] `{clipboard}` shows "[clipboard]"
- [ ] `{argument}` shows "[input]"
- [ ] Respects modifiers (uppercase, trim, etc.)

### US-4: Sync Scroll
**As a** user
**I want** editor and preview to scroll together
**So that** I can see corresponding sections

**Acceptance Criteria:**
- [ ] Scrolling editor scrolls preview proportionally
- [ ] Toggle to enable/disable sync scroll
- [ ] Handles different content heights gracefully

## Technical Notes

- Use `react-markdown` + `remark-gfm`
- Custom remark plugin for placeholder parsing
- Debounce updates (100ms)
- Virtualize for large docs if needed

## Dependencies

- Depends on: None
- Blocks: Split view editor (epic uqb)

## Out of Scope

- WYSIWYG editing
- Export to PDF
- Custom CSS themes
