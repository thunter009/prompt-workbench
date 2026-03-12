---
shaping: true
---

# Improve Prompt v2 — Shaping

## Requirements (R)

| ID | Requirement | Status |
|----|-------------|--------|
| R0 | See what changed — user needs to understand the diff, not just read a wall of new text | Must-have |
| R1 | Iterate — improve again or tweak instructions without starting over | Must-have |
| R2 | Multiple improvement strategies (concise, add detail, restructure, etc.) | Must-have |
| R3 | Stream response so user sees progress during generation | Must-have |
| R4 | Support LLM providers beyond Ollama (OpenAI, Anthropic, etc.) | Must-have |
| R5 | Preserve {{placeholder}} syntax through improvements | Must-have |

---

## CURRENT

| Part | Mechanism |
|------|-----------|
| **C1** | Sparkle button in editor toolbar triggers `/api/improve-prompt` |
| **C2** | API sends text + meta system prompt to Ollama `/api/generate` (non-streaming, 30s timeout) |
| **C3** | Review overlay shows improved text as plain `<pre>` block — accept or reject |
| **C4** | Meta system prompt stored in Zustand, editable in settings, persisted to SQLite |
| **C5** | Single generic strategy: "be clearer, more specific, more effective" |
| **C6** | Keyboard shortcuts: Enter=accept, Escape=reject during review |

---

## A: Incremental Enhancement (selected)

Evolve existing architecture — swap review panel for diff, add strategy picker, add streaming, abstract provider behind adapter.

| Part | Mechanism |
|------|-----------|
| **A1** | **Diff review** — replace `<pre>` overlay with CodeMirror MergeView (already in project for other use) showing original vs improved |
| **A2** | **Strategy picker** — dropdown/popover on sparkle button with preset strategies (concise, detailed, restructure, custom). Each strategy = a system prompt template |
| **A3** | **Iterate loop** — version stack (v1→v2→v3) with back/forward nav + inline instruction field between rounds ("make it shorter", "keep bullets"). "Improve again" re-sends current version with tweaked instruction. Stack lets user navigate/compare previous versions |
| **A4** | **Streaming with deferred diff** — API streams tokens, UI shows streaming text in plain view with progress. On completion, flips to CodeMirror MergeView for diff review. MergeView can't do incremental diff (computes at construction time), so buffer-then-render is the mechanism |
| **A5** | **Provider adapter** — abstract LLM call behind interface: `{ generate(system, prompt, opts): AsyncIterable<string> }`. Implement Ollama + OpenAI-compatible + Anthropic adapters |
| **A6** | **Placeholder preservation** — post-process: validate all `{{placeholders}}` from original appear in improved text. Warn if any dropped |

## Fit Check: R × A

| Req | Requirement | Status | A |
|-----|-------------|--------|---|
| R0 | See what changed — diff not wall of text | Must-have | ✅ |
| R1 | Iterate — improve again or tweak instructions | Must-have | ✅ |
| R2 | Multiple improvement strategies | Must-have | ✅ |
| R3 | Stream response | Must-have | ✅ |
| R4 | Support providers beyond Ollama | Must-have | ✅ |
| R5 | Preserve {{placeholder}} syntax | Must-have | ✅ |

---

## Detail A: Breadboard

### Places

| # | Place | Description |
|---|-------|-------------|
| P1 | Editor (idle) | Normal editor state, sparkle button visible |
| P2 | Streaming | Tokens arriving, plain text preview + progress |
| P3 | Diff Review | MergeView showing original vs improved, accept/reject/iterate |
| P4 | Strategy Picker | Popover on sparkle button with strategy options |
| P5 | Settings Modal | AI settings: provider config + meta system prompt |
| P6 | Backend | API endpoint + provider adapters |

### UI Affordances

| # | Place | Component | Affordance | Control | Wires Out | Returns To |
|---|-------|-----------|------------|---------|-----------|------------|
| U1 | P1 | EditorToolbar | sparkle button | click | → P4 | — |
| U2 | P4 | StrategyPicker | strategy list (concise, detailed, restructure, custom) | click | → N1 | — |
| U3 | P4 | StrategyPicker | custom instruction input | type | — | → N1 |
| U4 | P2 | StreamingView | streaming text (plain `<pre>`) | render | — | — |
| U5 | P2 | StreamingView | progress indicator (token count / spinner) | render | — | — |
| U6 | P2 | StreamingView | cancel button | click | → N3 | — |
| U7 | P3 | DiffReview | InlineDiffView (unified/split toggle, hunk nav) | render | — | — |
| U8 | P3 | DiffReview | accept button | click | → N5 | — |
| U9 | P3 | DiffReview | reject button | click | → N6 | — |
| U10 | P3 | DiffReview | "Improve again" button | click | → N7 | — |
| U11 | P3 | DiffReview | instruction input ("make it shorter...") | type | — | → N7 |
| U12 | P3 | DiffReview | version nav (v1/v2/v3 + back/forward) | click | → N8 | — |
| U13 | P3 | DiffReview | placeholder warning banner | render | — | — |
| U14 | P5 | SettingsModal | provider selector (Ollama / OpenAI / Anthropic) | select | → N10 | — |
| U15 | P5 | SettingsModal | API key input | type | → N10 | — |
| U16 | P5 | SettingsModal | meta system prompt textarea | type | → N11 | — |
| U17 | P5 | SettingsModal | model selector dropdown | select | → N10 | — |

### Code Affordances

| # | Place | Component | Affordance | Control | Wires Out | Returns To |
|---|-------|-----------|------------|---------|-----------|------------|
| N1 | P1 | useImprovePrompt | `handleImprove(strategy)` | call | → N2 | — |
| N2 | P6 | improve-prompt/route | `POST /api/improve-prompt` (streaming) | call | → N12 | → N4 |
| N3 | P2 | useImprovePrompt | `abort()` via AbortController | call | — | — |
| N4 | P2 | useImprovePrompt | `onToken(chunk)` — appends to buffer | call | — | → U4, U5 |
| N5 | P3 | useImprovePrompt | `accept()` — writes improved text to editor + snippet store | call | → S3 | — |
| N6 | P3 | useImprovePrompt | `reject()` — clears state, returns to P1 | call | — | — |
| N7 | P3 | useImprovePrompt | `improveAgain(instruction?)` — pushes current to stack, re-sends with instruction | call | → N1 | — |
| N8 | P3 | useImprovePrompt | `goToVersion(n)` — navigates version stack, updates diff view | call | — | → U7, U12 |
| N9 | P3 | useImprovePrompt | `checkPlaceholders(original, improved)` — compares `{{...}}` tokens | call | — | → U13 |
| N10 | P5 | ai-settings-store | `setProvider(config)` — persists provider type + API key + model | call | → S1 | — |
| N11 | P5 | ai-settings-store | `setMetaSystemPrompt(prompt)` | call | → S1 | — |
| N12 | P6 | provider-adapter | `generate(system, prompt, opts): AsyncIterable<string>` | call | — | → N2 |

### Data Stores

| # | Place | Store | Description |
|---|-------|-------|-------------|
| S1 | P5 | ai-settings-store | Provider config (type, url, apiKey, model) + meta system prompt. Persisted to SQLite |
| S2 | P3 | version-stack | Array of `{ text: string, instruction?: string }`. Pushed on each improve round |
| S3 | P1 | snippet-store | Snippet text updated on accept |

---

## Slices

| # | Slice | Parts | Demo |
|---|-------|-------|------|
| V1 | Diff review replaces plain overlay | A1 | Click improve → see diff with hunk nav, unified/split toggle. Accept/reject work |
| V2 | Streaming + deferred diff | A4 | Click improve → see tokens stream in → diff appears on completion. Cancel works |
| V3 | Strategy picker | A2 | Click sparkle → popover with strategies → pick one → improves with that strategy |
| V4 | Iterate with version stack | A3 | In diff review → type instruction → "improve again" → v2 appears → navigate back to v1 |
| V5 | Provider adapter + settings | A5 | Settings → pick OpenAI → enter key → improve uses OpenAI. Ollama still works |
| V6 | Placeholder preservation | A6 | Improve a prompt with `{{placeholders}}` → warning if any dropped |

### V1: Diff review replaces plain overlay

| # | Component | Affordance | Control | Wires Out | Returns To |
|---|-----------|------------|---------|-----------|------------|
| U7 | DiffReview | InlineDiffView (unified/split, hunk nav) | render | — | — |
| U8 | DiffReview | accept button | click | → N5 | — |
| U9 | DiffReview | reject button | click | → N6 | — |
| N5 | useImprovePrompt | `accept()` | call | → S3 | — |
| N6 | useImprovePrompt | `reject()` | call | — | — |

**Replaces:** current `ImprovePromptReview` (`<pre>` overlay) with `InlineDiffView` wrapper. Reuses existing `DiffMergeView`/`SideBySideMergeView` + toolbar from `InlineDiffView.tsx`. Existing API call unchanged.

### V2: Streaming + deferred diff

| # | Component | Affordance | Control | Wires Out | Returns To |
|---|-----------|------------|---------|-----------|------------|
| U4 | StreamingView | streaming text (plain `<pre>`) | render | — | — |
| U5 | StreamingView | progress indicator | render | — | — |
| U6 | StreamingView | cancel button | click | → N3 | — |
| N2 | improve-prompt/route | `POST /api/improve-prompt` (now streaming) | call | → N12 | → N4 |
| N3 | useImprovePrompt | `abort()` | call | — | — |
| N4 | useImprovePrompt | `onToken(chunk)` | call | — | → U4, U5 |

**Changes:** API switches to streaming response (`stream: true` for Ollama). Hook gets `streaming` status between `loading` and `review`. Tokens buffer in state, flip to V1's diff view on completion.

### V3: Strategy picker

| # | Component | Affordance | Control | Wires Out | Returns To |
|---|-----------|------------|---------|-----------|------------|
| U1 | EditorToolbar | sparkle button (now opens picker) | click | → P4 | — |
| U2 | StrategyPicker | strategy list | click | → N1 | — |
| U3 | StrategyPicker | custom instruction input | type | — | → N1 |
| N1 | useImprovePrompt | `handleImprove(strategy)` | call | → N2 | — |

**Changes:** Sparkle button click opens popover instead of directly improving. Preset strategies are system prompt templates stored as constants. Custom input lets user type freeform instruction appended to meta system prompt. `handleImprove` accepts strategy param.

### V4: Iterate with version stack

| # | Component | Affordance | Control | Wires Out | Returns To |
|---|-----------|------------|---------|-----------|------------|
| U10 | DiffReview | "Improve again" button | click | → N7 | — |
| U11 | DiffReview | instruction input | type | — | → N7 |
| U12 | DiffReview | version nav (v1/v2/v3 + back/forward) | click | → N8 | — |
| N7 | useImprovePrompt | `improveAgain(instruction?)` | call | → N1 | — |
| N8 | useImprovePrompt | `goToVersion(n)` | call | — | → U7, U12 |
| S2 | — | version-stack | `{ text, instruction }[]` | — | — |

**Changes:** Hook gains version stack array. "Improve again" pushes current improved text to stack, re-triggers improve with optional instruction. Version nav updates which pair is shown in diff view (always diffing against original or previous version).

### V5: Provider adapter + settings

| # | Component | Affordance | Control | Wires Out | Returns To |
|---|-----------|------------|---------|-----------|------------|
| U14 | SettingsModal | provider selector | select | → N10 | — |
| U15 | SettingsModal | API key input | type | → N10 | — |
| U17 | SettingsModal | model selector | select | → N10 | — |
| N10 | ai-settings-store | `setProvider(config)` | call | → S1 | — |
| N12 | provider-adapter | `generate(system, prompt, opts)` | call | — | → N2 |

**Changes:** New `src/lib/llm/` module with adapter interface + implementations for Ollama, OpenAI-compatible, Anthropic. API route delegates to adapter based on provider config. Settings UI gains provider picker + API key field. Model dropdown fetches available models per provider.

### V6: Placeholder preservation

| # | Component | Affordance | Control | Wires Out | Returns To |
|---|-----------|------------|---------|-----------|------------|
| U13 | DiffReview | placeholder warning banner | render | — | — |
| N9 | useImprovePrompt | `checkPlaceholders(original, improved)` | call | — | → U13 |

**Changes:** After improvement completes, regex extracts `{{...}}` from both original and improved. Missing placeholders shown in warning banner above diff view. Non-blocking — user can still accept.
