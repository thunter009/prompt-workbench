# PRD: Real-time File Sync

**Epic ID:** prompt-workbench-esx
**Priority:** P1
**Status:** Draft

## Problem Statement

Users edit snippets in Raycast directly. App needs to detect external changes and sync bidirectionally without manual intervention.

## Goal

Automatic file watching with chokidar + configurable interval backup via node-cron.

## User Stories

### US-1: File Watcher Setup
**As a** user
**I want** app to watch Raycast config directory
**So that** external changes sync automatically

**Acceptance Criteria:**
- [ ] Watches `~/Library/Application Support/Raycast/`
- [ ] Detects file additions, changes, deletions
- [ ] Debounced (1 second) to batch rapid changes
- [ ] Runs in background, minimal CPU usage

### US-2: Change Detection
**As a** user
**I want** to be notified when external changes detected
**So that** I'm aware of incoming updates

**Acceptance Criteria:**
- [ ] Toast notification on detected change
- [ ] Shows count of changed snippets
- [ ] "View Changes" action on toast
- [ ] Auto-dismisses after 5 seconds

### US-3: Conflict Resolution
**As a** user
**I want** to resolve conflicts when both sides changed
**So that** I don't lose work

**Acceptance Criteria:**
- [ ] Detects when same snippet edited in both places
- [ ] Shows side-by-side diff
- [ ] Options: Keep Local, Keep Remote, Merge
- [ ] "Apply to all" for bulk conflicts

### US-4: Interval Sync
**As a** user
**I want** scheduled sync as backup
**So that** nothing is missed

**Acceptance Criteria:**
- [ ] Default: every 30 minutes
- [ ] Configurable: 5m, 15m, 30m, 1h, 4h
- [ ] Uses node-cron for scheduling
- [ ] Runs even if watcher missed something

### US-5: Sync Settings UI
**As a** user
**I want** to configure sync behavior
**So that** I can adjust to my workflow

**Acceptance Criteria:**
- [ ] Toggle: Enable file watcher (default: on)
- [ ] Toggle: Enable interval sync (default: on)
- [ ] Dropdown: Interval frequency
- [ ] Display: Last sync timestamp
- [ ] Button: "Sync Now"

### US-6: Sync History
**As a** user
**I want** to see sync history
**So that** I can audit what changed

**Acceptance Criteria:**
- [ ] Log of last 50 sync events
- [ ] Shows: timestamp, direction, snippet count
- [ ] Expandable to see individual items
- [ ] Filterable by direction (in/out)

## Technical Notes

- chokidar for file watching (already in stack)
- node-cron for intervals
- Sync engine in `/src/lib/sync/`
- Use file checksums for change detection
- Queue changes to prevent race conditions

## Dependencies

- Depends on: Zustand store (completed), Supabase schema
- Includes: Conflict detection UI (issue 88r) - child task of this epic

## Out of Scope

- Cloud sync (Supabase hosted)
- Multi-device sync
- Sync with other apps
