# PRD: Improve Prompt Button

**Priority:** P1
**Status:** Draft

## Problem Statement

Users write prompts but have no way to iteratively refine them with AI assistance. They must manually copy text to a chat, get suggestions, then paste back. The app already has Ollama integration for keywords/folders but not for the core task: improving prompts.

## Goal

Add an "Improve Prompt" button that sends the current snippet text through Ollama with a configurable meta system prompt, then shows the improved version for the user to accept or reject.

## What Already Exists

- CodeMirror 6 editor in `src/components/editor/Editor.tsx`
- `EditorPanelHeader` with keyword/folder suggestion UI
- `useAISettingsStore` with Ollama URL/model config
- `SettingsModal` with AI settings section
- `POST /api/suggest-folder` and `/api/suggest-keyword` as API pattern examples

## User Stories

### US-1: Meta System Prompt Store
**As a** user
**I want** a configurable system prompt for prompt improvement
**So that** I control how the AI rewrites my prompts

**Acceptance Criteria:**
- [ ] Add `metaSystemPrompt` field to `ai-settings-store.ts`
- [ ] Default value: a sensible meta-prompt instructing the LLM to improve clarity, structure, and specificity of prompt templates while preserving placeholders
- [ ] Persisted to localStorage with existing AI settings
- [ ] `npx tsc --noEmit` passes
- [ ] `pnpm build` passes

### US-2: Improve Prompt API Endpoint
**As a** developer
**I want** a POST endpoint that improves prompt text via Ollama
**So that** the frontend can request prompt improvements

**Acceptance Criteria:**
- [ ] Create `POST /api/improve-prompt` in `src/app/api/improve-prompt/route.ts`
- [ ] Request body: `{ text: string; systemPrompt: string; ollamaUrl?: string; model?: string }`
- [ ] Response: `{ improved: string; model: string }`
- [ ] Sends systemPrompt as system message, snippet text as user message to Ollama
- [ ] 30s timeout (prompt improvement is slower than keyword/folder suggestions)
- [ ] Graceful error handling: return `{ error: string }` on failure
- [ ] `npx tsc --noEmit` passes
- [ ] `pnpm build` passes

### US-3: Improve Button + Diff Review UI
**As a** user
**I want** a button to improve my prompt and review the changes before accepting
**So that** I stay in control of edits

**Acceptance Criteria:**
- [ ] Add sparkle/wand button in editor toolbar area (near the editor, above or beside CodeMirror)
- [ ] Button disabled when snippet text is empty or too short (<20 chars)
- [ ] Click triggers `/api/improve-prompt` with current text + meta system prompt from store
- [ ] Loading state: spinner on button, editor area shows subtle overlay
- [ ] On success: show improved text in a review panel/modal with Accept and Reject buttons
- [ ] Accept: replaces editor content with improved text
- [ ] Reject: dismisses review, keeps original text
- [ ] Keyboard: Enter to accept, Escape to reject when review is focused
- [ ] `npx tsc --noEmit` passes
- [ ] `pnpm build` passes
- [ ] Verify in browser: button visible, loading state works, accept/reject work

### US-4: Meta System Prompt Settings UI
**As a** user
**I want** to edit the meta system prompt in settings
**So that** I can customize how prompts are improved

**Acceptance Criteria:**
- [ ] Add "Prompt Improvement" section to `SettingsModal` (in AI Settings area)
- [ ] Textarea showing current meta system prompt (resizable, min 4 rows)
- [ ] "Reset to Default" button to restore the default meta-prompt
- [ ] Changes save immediately via store
- [ ] `npx tsc --noEmit` passes
- [ ] `pnpm build` passes
- [ ] Verify in browser: textarea renders, edits persist, reset works

## Technical Notes

- Reuse `useAISettingsStore` for meta system prompt (no new store needed)
- API pattern matches existing `/api/suggest-folder` and `/api/suggest-keyword`
- Use Ollama `/api/generate` with system prompt parameter
- Review UI can be inline (replace editor temporarily) or modal — prefer inline for smoother UX

## Dependencies

- Depends on: Ollama integration (done), Editor (done)
- No blockers

## Out of Scope

- Side-by-side diff view (just show improved text)
- Multiple improvement suggestions to choose from
- Streaming response (keep it simple with full response)
- Undo after accepting (standard Cmd+Z in editor handles this)
- Per-snippet system prompt overrides
