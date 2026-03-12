---
shaping: true
---

# Improve Prompt v2 — Slices

Parent: [improve-prompt-v2.md](./improve-prompt-v2.md) (Shape A selected)

## Slice Summary

| # | Slice | Parts | Demo |
|---|-------|-------|------|
| V1 | Diff review replaces plain overlay | A1 | Click improve → diff with hunk nav, unified/split toggle. Accept/reject |
| V2 | Streaming + deferred diff | A4 | Tokens stream live → diff on completion. Cancel works |
| V3 | Strategy picker | A2 | Sparkle → popover → pick strategy → improves accordingly |
| V4 | Iterate with version stack | A3 | Diff review → instruction → "improve again" → v2 → nav back to v1 |
| V5 | Provider adapter + settings | A5 | Settings → pick OpenAI → enter key → improve uses OpenAI |
| V6 | Placeholder preservation | A6 | Improve prompt with `{{placeholders}}` → warning if any dropped |

---

## V1: Diff review replaces plain overlay

**Demo:** Click improve → see real diff with hunk navigation, unified/split toggle. Accept/reject work.

**What changes:**
- Replace `ImprovePromptReview` (`<pre>` overlay) with `InlineDiffView` wrapper
- Reuse existing `DiffMergeView`/`SideBySideMergeView` + toolbar from `InlineDiffView.tsx`
- Existing API call unchanged
- Keyboard: `[`/`]` hunk nav, Escape reject come free from InlineDiffView

| # | Component | Affordance | Control | Wires Out | Returns To |
|---|-----------|------------|---------|-----------|------------|
| U7 | DiffReview | InlineDiffView (unified/split, hunk nav) | render | — | — |
| U8 | DiffReview | accept button | click | → N5 | — |
| U9 | DiffReview | reject button | click | → N6 | — |
| N5 | useImprovePrompt | `accept()` | call | → S3 | — |
| N6 | useImprovePrompt | `reject()` | call | — | — |

**Key files:**
- Modify: `src/components/ImprovePrompt.tsx` (replace review component)
- Reuse: `src/components/editor/InlineDiffView.tsx`, `DiffMergeView.tsx`
- Modify: `src/hooks/useEditorSync.ts` (wire new review)

---

## V2: Streaming + deferred diff

**Demo:** Click improve → see tokens stream in live → diff appears on completion. Cancel button works.

**What changes:**
- API switches to streaming response (`stream: true` for Ollama, SSE for client)
- Hook gains `streaming` status between `loading` and `review`
- New `StreamingView` component: plain `<pre>` + progress + cancel
- Tokens buffer in state → flip to V1's diff view on stream complete

| # | Component | Affordance | Control | Wires Out | Returns To |
|---|-----------|------------|---------|-----------|------------|
| U4 | StreamingView | streaming text (plain `<pre>`) | render | — | — |
| U5 | StreamingView | progress indicator | render | — | — |
| U6 | StreamingView | cancel button | click | → N3 | — |
| N2 | improve-prompt/route | `POST /api/improve-prompt` (streaming) | call | → N12 | → N4 |
| N3 | useImprovePrompt | `abort()` | call | — | — |
| N4 | useImprovePrompt | `onToken(chunk)` | call | — | → U4, U5 |

**Key files:**
- Modify: `src/app/api/improve-prompt/route.ts` (streaming response)
- Modify: `src/components/ImprovePrompt.tsx` (add StreamingView, new status)
- Modify: `src/hooks/useEditorSync.ts`

---

## V3: Strategy picker

**Demo:** Click sparkle → popover with strategies → pick one → improves with that strategy's system prompt.

**What changes:**
- Sparkle button click opens popover instead of directly improving
- Preset strategies as system prompt templates (constants)
- Custom input: freeform instruction appended to meta system prompt
- `handleImprove` accepts strategy param

| # | Component | Affordance | Control | Wires Out | Returns To |
|---|-----------|------------|---------|-----------|------------|
| U1 | EditorToolbar | sparkle button (opens picker) | click | → P4 | — |
| U2 | StrategyPicker | strategy list | click | → N1 | — |
| U3 | StrategyPicker | custom instruction input | type | — | → N1 |
| N1 | useImprovePrompt | `handleImprove(strategy)` | call | → N2 | — |

**Key files:**
- New: `src/components/StrategyPicker.tsx`
- Modify: `src/components/ImprovePrompt.tsx` (button opens popover, hook accepts strategy)

---

## V4: Iterate with version stack

**Demo:** In diff review → type instruction → "improve again" → v2 appears → navigate back to v1.

**What changes:**
- Hook gains version stack: `{ text: string, instruction?: string }[]`
- "Improve again" pushes current to stack, re-triggers with optional instruction
- Version nav updates which pair is shown in diff (always diff against original)
- Instruction input in diff review toolbar

| # | Component | Affordance | Control | Wires Out | Returns To |
|---|-----------|------------|---------|-----------|------------|
| U10 | DiffReview | "Improve again" button | click | → N7 | — |
| U11 | DiffReview | instruction input | type | — | → N7 |
| U12 | DiffReview | version nav (v1/v2/v3 + back/forward) | click | → N8 | — |
| N7 | useImprovePrompt | `improveAgain(instruction?)` | call | → N1 | — |
| N8 | useImprovePrompt | `goToVersion(n)` | call | — | → U7, U12 |
| S2 | — | version-stack | `{ text, instruction }[]` | — | — |

**Key files:**
- Modify: `src/components/ImprovePrompt.tsx` (add version stack to hook, iterate UI)

---

## V5: Provider adapter + settings

**Demo:** Settings → pick OpenAI → enter API key → improve uses OpenAI instead of Ollama.

**What changes:**
- New `src/lib/llm/` module with adapter interface
- Adapters: Ollama, OpenAI-compatible, Anthropic — all implement `generate(): AsyncIterable<string>`
- API route delegates to adapter based on provider config from store
- Settings UI: provider picker + API key field + model dropdown per provider
- ai-settings-store gains provider type + API key fields

| # | Component | Affordance | Control | Wires Out | Returns To |
|---|-----------|------------|---------|-----------|------------|
| U14 | SettingsModal | provider selector | select | → N10 | — |
| U15 | SettingsModal | API key input | type | → N10 | — |
| U17 | SettingsModal | model selector | select | → N10 | — |
| N10 | ai-settings-store | `setProvider(config)` | call | → S1 | — |
| N12 | provider-adapter | `generate(system, prompt, opts)` | call | — | → N2 |

**Key files:**
- New: `src/lib/llm/index.ts` (interface), `src/lib/llm/ollama.ts`, `src/lib/llm/openai.ts`, `src/lib/llm/anthropic.ts`
- Modify: `src/lib/ai-settings-store.ts` (provider config)
- Modify: `src/components/SettingsModal.tsx` (provider UI)
- Modify: `src/app/api/improve-prompt/route.ts` (use adapter)

---

## V6: Placeholder preservation

**Demo:** Improve a prompt containing `{{name}}` and `{{role}}` → see warning if model dropped any.

**What changes:**
- After improvement completes, regex extracts `{{...}}` from original and improved
- Missing placeholders shown in warning banner above diff view
- Non-blocking — user can still accept despite warning

| # | Component | Affordance | Control | Wires Out | Returns To |
|---|-----------|------------|---------|-----------|------------|
| U13 | DiffReview | placeholder warning banner | render | — | — |
| N9 | useImprovePrompt | `checkPlaceholders(original, improved)` | call | — | → U13 |

**Key files:**
- Modify: `src/components/ImprovePrompt.tsx` (add check + banner)
