# PRD: Split View Editor

**Epic ID:** prompt-workbench-uqb
**Priority:** P1
**Status:** Draft

## Problem Statement

Users need to see their prompt output while editing. Currently no way to preview rendered markdown alongside the editor.

## Goal

Implement resizable split-pane layout: editor on left, live preview on right.

## User Stories

### US-1: Basic Split Layout
**As a** user
**I want** editor and preview side-by-side
**So that** I can see rendered output while typing

**Acceptance Criteria:**
- [ ] Editor takes left pane (default 60%)
- [ ] Preview takes right pane (default 40%)
- [ ] Both panes scroll independently
- [ ] Layout persists on refresh

### US-2: Resizable Divider
**As a** user
**I want** to drag the divider between panes
**So that** I can adjust proportions to my preference

**Acceptance Criteria:**
- [ ] Draggable divider between panes
- [ ] Min width 200px per pane
- [ ] Cursor changes on hover
- [ ] Size persists in localStorage

### US-3: Toggle Preview
**As a** user
**I want** to collapse/expand preview pane
**So that** I can maximize editor when needed

**Acceptance Criteria:**
- [ ] Keyboard shortcut (Cmd+\) toggles preview
- [ ] Button in toolbar toggles preview
- [ ] Smooth animation on toggle
- [ ] State persists

## Technical Notes

- Use `react-resizable-panels` or similar
- Store split ratio in Zustand + localStorage
- Preview component already exists, just needs integration

## Dependencies

- Depends on: Live markdown preview pane (epic dc2)
- Blocks: None

## Out of Scope

- Vertical split option
- Multiple preview panes
- Floating preview window
