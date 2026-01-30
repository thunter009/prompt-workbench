# PRD: Prompt Workbench UX Improvements

## Overview
Improve snippet editing workflow and export configuration. Epic 1 (Critical Fixes - crypto.randomUUID fallback) is complete. This covers Epic 2 (Snippet Editing UX) and Epic 3 (Settings & Export).

## Goals
- Enable fast inline editing of snippet titles in sidebar
- Add keyword field for Raycast integration in editor
- Auto-save snippets on content change
- Auto-infer titles via local Ollama LLM
- Provide settings page for export configuration

## Quality Gates

Every user story must pass:
- `npx tsc --noEmit` - Type checking
- `pnpm lint` - Linting
- Visual browser verification for UI changes

## User Stories

### US-001: Inline title editing via double-click
**Description:** As a user, I want to double-click a snippet name in the sidebar to edit it inline.

**Acceptance Criteria:**
- [ ] Double-clicking snippet name enters edit mode with input field
- [ ] Input pre-filled with current name, text selected
- [ ] Enter saves, Escape cancels, click-outside saves
- [ ] Empty name reverts to previous value

### US-002: Inline title editing via edit icon
**Description:** As a user, I want to click an edit icon next to snippet names to trigger inline editing.

**Acceptance Criteria:**
- [ ] Edit icon (pencil) appears on hover next to snippet name
- [ ] Clicking icon enters same edit mode as double-click
- [ ] Icon hidden during edit mode

### US-003: Add keyword field to editor panel
**Description:** As a user, I want to see and edit the Raycast keyword directly in the editor panel.

**Acceptance Criteria:**
- [ ] Keyword input field always visible in editor panel
- [ ] Field shows placeholder "!keyword" when empty
- [ ] Changes save with debounce like other fields

### US-004: Auto-save on content change
**Description:** As a user, I want snippets to auto-save when I type.

**Acceptance Criteria:**
- [ ] New snippet created automatically when typing in empty editor
- [ ] All changes (title, text, keyword) debounced and auto-saved
- [ ] Visual indicator shows save status (saved/saving)

### US-005: Auto-infer title via Ollama
**Description:** As a user, I want untitled snippets to auto-generate a title from content using local LLM.

**Acceptance Criteria:**
- [ ] API route `/api/infer-title` calls local Ollama
- [ ] When title is "Untitled" and content >50 chars, auto-infer after debounce
- [ ] Inferred title set directly (no confirmation UI)
- [ ] Graceful fallback if Ollama unavailable (keep "Untitled")
- [ ] Configurable Ollama endpoint in settings

### US-006: Settings page route
**Description:** As a user, I want a dedicated settings page.

**Acceptance Criteria:**
- [ ] New route at `/settings`
- [ ] Accessible via gear icon in header
- [ ] Back navigation to main view

### US-007: Default export path setting
**Description:** As a user, I want to set a default export directory in settings.

**Acceptance Criteria:**
- [ ] "Export Directory" section in settings page
- [ ] Shows current path or "Not set"
- [ ] "Choose Folder" button opens directory picker
- [ ] "Clear" button removes saved path
- [ ] Persists across sessions via IndexedDB

### US-008: Ollama endpoint setting
**Description:** As a user, I want to configure the Ollama endpoint for title inference.

**Acceptance Criteria:**
- [ ] "AI Settings" section in settings page
- [ ] Ollama URL field (default: http://localhost:11434)
- [ ] Model selection dropdown (fetch available models from Ollama)
- [ ] Test connection button

## Functional Requirements
- FR-1: Inline edit must not conflict with drag-and-drop
- FR-2: Auto-save uses existing 2s debounce
- FR-3: Ollama calls use `/api/generate` endpoint
- FR-4: Settings persist to localStorage

## Non-Goals
- Bulk rename operations
- Cloud LLM providers (OpenAI, Claude API)
- Export path per-folder

## Technical Considerations
- Ollama API: POST to `{endpoint}/api/generate` with model + prompt
- Existing `pickDefaultExportDirectory()` in `src/lib/raycast/export.ts` reusable
- Settings store pattern: follow `sync-settings-store.ts`
