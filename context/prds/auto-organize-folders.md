# PRD: Folder Organization Methodology

**Epic ID:** prompt-workbench-843 (continuation)
**Priority:** P2
**Status:** In Progress

## Problem Statement

Folder suggestion API exists but suggestions are unconstrained — Ollama invents arbitrary folder names with no consistency. Users with organizational systems (PARA, Johnny Decimal, etc.) get suggestions that don't match their methodology.

## Goal

Add a methodology configuration layer so folder suggestions conform to the user's preferred organizational system. Validate folder names against methodology rules.

## What Already Exists

- `POST /api/suggest-folder` — Ollama-powered folder suggestion endpoint
- `FolderSuggestions` component — auto-suggest pills + on-demand popover
- `FolderReorgModal` — batch reorganize modal with scan/select/apply
- `SettingsModal` — has AI settings section (Ollama URL/model)
- Folder tree with drag-drop, create, rename, delete

## User Stories

### US-1: Folder Methodology Config Types
**As a** developer
**I want** a methodology configuration schema
**So that** the system knows how to constrain folder suggestions

**Acceptance Criteria:**
- [ ] Create `/src/lib/folder-methodology.ts` with Zustand store
- [ ] `MethodologyPreset` type: `"flat" | "para" | "johnny-decimal" | "custom"`
- [ ] `"flat"` (default): no constraints, current behavior
- [ ] `"para"`: top-level must be Projects / Areas / Resources / Archive
- [ ] `"johnny-decimal"`: areas (10-19, 20-29...), categories (11, 12...)
- [ ] `"custom"`: user-defined list of allowed top-level folder names
- [ ] Persist to localStorage key `prompt-workbench-folder-methodology`
- [ ] Export `getMethodologyPromptContext()` that returns LLM prompt fragment describing active methodology rules
- [ ] `npx tsc --noEmit` passes
- [ ] `pnpm build` passes

### US-2: Inject Methodology into Suggestion API
**As a** user
**I want** folder suggestions to follow my methodology
**So that** suggestions are consistent with my organizational system

**Acceptance Criteria:**
- [ ] `POST /api/suggest-folder` accepts optional `methodology` field in request body
- [ ] When methodology provided, append methodology rules to Ollama prompt
- [ ] PARA: instruct LLM to only suggest subfolders within Projects/Areas/Resources/Archive
- [ ] JD: instruct LLM to suggest folders matching XX or XX.XX numbering
- [ ] Custom: instruct LLM to only use provided top-level folder names
- [ ] `FolderSuggestions` component sends methodology config with API calls
- [ ] `FolderReorgModal` sends methodology config with API calls
- [ ] Flat methodology = no change to current prompt (backward compat)
- [ ] `npx tsc --noEmit` passes
- [ ] `pnpm build` passes

### US-3: Methodology Settings UI
**As a** user
**I want** to choose my methodology in settings
**So that** I can configure the system to match my workflow

**Acceptance Criteria:**
- [ ] Add "Folder Organization" section to `SettingsModal` (after AI Settings section)
- [ ] Radio group or dropdown: Flat (default), PARA, Johnny Decimal, Custom
- [ ] When PARA selected: show read-only preview of folder structure
- [ ] When Custom selected: show editable list of allowed top-level folder names (add/remove)
- [ ] Changes save immediately (Zustand persist)
- [ ] `npx tsc --noEmit` passes
- [ ] `pnpm build` passes
- [ ] Verify in browser: section renders, switching presets works, custom list editable

### US-4: Folder Name Validation
**As a** user
**I want** warnings when folder names don't match my methodology
**So that** I keep my organization consistent

**Acceptance Criteria:**
- [ ] Add `validateFolderName(name: string, config: MethodologyConfig): { valid: boolean; warning?: string }` to folder-methodology.ts
- [ ] PARA: warn if top-level folder is not Projects/Areas/Resources/Archive
- [ ] JD: warn if name doesn't match area (X0-X9) or category (XX) pattern
- [ ] Custom: warn if top-level name not in allowed list
- [ ] Show yellow warning badge in sidebar when folder name doesn't match methodology
- [ ] Validation runs on manual folder create/rename only (not on AI-created folders)
- [ ] `npx tsc --noEmit` passes
- [ ] `pnpm build` passes

## Technical Notes

- New Zustand store in `/src/lib/folder-methodology.ts` with localStorage persist
- API changes are additive — methodology field is optional, flat = no-op
- Validation is advisory (warnings), never blocking

## Dependencies

- Depends on: Folder tree (ep0, done), Suggestion API (843.10, done)
- No blockers

## Out of Scope

- Auto-detecting methodology from existing folders
- Batch folder rename to match methodology
- Sub-folder level methodology rules (only top-level constraints)
- Syncing methodology config to Supabase
