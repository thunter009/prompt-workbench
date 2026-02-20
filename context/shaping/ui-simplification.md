---
shaping: true
---

# UI/UX Cleanup & Simplification — Shaping

## Requirements (R)

| ID | Requirement | Status |
|----|-------------|--------|
| R0 | Reduce cognitive load — the app should feel like a focused tool, not a feature demo | Core goal |
| R1 | page.tsx should be decomposed — 1100 lines mixing layout, handlers, export logic, sync logic is unmaintainable | Must-have |
| R2 | Consolidate search surfaces — 3 separate palettes (commands, snippets, cross-snippet) should collapse into fewer entry points | Must-have |
| R3 | AI features (keyword suggest, folder suggest, improve prompt, batch reorg) should have a consistent, non-cluttered pattern | Must-have |
| R4 | Editor header should not be a junk drawer — keyword, folder, suggestions, toggles, save indicator all compete for space | Must-have |
| R5 | Header bar icons need to be scannable — 8+ unlabeled icons is a guessing game | Must-have |
| R6 | Per-pane theming adds complexity for marginal value — evaluate whether to keep | Nice-to-have |
| R7 | Reduce store sprawl — 9 Zustand stores could be fewer without losing separation of concerns | Nice-to-have |
| R8 | Settings modal is a kitchen sink — Ollama, sync, export, keyword style all in one place with no organization | Must-have |

---

## A: Incremental Cleanup

Keep the 3-panel layout. Decompose, consolidate, declutter.

| Part | Mechanism |
|------|-----------|
| **A1** | **Decompose page.tsx** — extract layout shell, keyboard handler, export/sync logic, header bar into focused modules. page.tsx becomes pure composition. |
| **A2** | **Merge search palettes** — unify ⌘K (commands) and ⌘P (snippets) into one palette with tab modes. ⌘⇧F stays separate (it's a different interaction: persistent results panel, not quick-pick). |
| **A3** | **AI actions behind one trigger** — replace scattered suggest buttons with a single "AI assist" menu (⌘J or similar) that offers: suggest keyword, suggest folder, improve prompt, batch reorg. Context-sensitive: only shows relevant actions. |
| **A4** | **Editor header cleanup** — keyword + folder fields stay. Move save indicator to status bar or editor gutter. Move inline-preview toggle and pane-theme toggle into a "..." overflow menu. Remove suggestion components from header — they're now in A3's AI menu. |
| **A5** | **Header bar grouping** — group icons: left = nav (sidebar toggle), center = title, right = grouped by function (sync/export cluster, tools cluster, settings). Add tooltip labels. |
| **A6** | **Settings sections** — split modal into tabbed sections: General, AI/Ollama, Sync & Export, Keyboard Style. |
| **A7** | **Strip pane theming** — remove PaneThemeProvider/PaneThemeToggle. Single app-wide theme. |
| **A8** | **Consolidate stores** — merge playground-store + ai-settings-store into one. Merge sync-settings + sync-history into one. 9 → ~6 stores. |

---

## B: Opinionated Redesign

Rethink the panel model. Fewer surfaces, fewer modes.

| Part | Mechanism | Flag |
|------|-----------|:----:|
| **B1** | **Two-panel layout** — sidebar + main area. No permanent preview panel. Preview is a toggle mode on the editor (split or overlay), like VS Code markdown preview. Playground opens as a drawer/sheet from bottom. | |
| **B2** | **Single command surface** — one ⌘K palette handles everything: snippet search, commands, AI actions. Type to search snippets, prefix with `>` for commands, `@` for AI actions. No separate ⌘P or ⌘⇧F. Cross-snippet search is a command that opens inline results. | ⚠️ |
| **B3** | **Contextual toolbar** — replace fixed editor header + app header with a single contextual bar. Shows snippet name + keyword inline. Actions appear based on context (editing → save/preview/improve, selecting multiple → bulk actions, no selection → create/import). | ⚠️ |
| **B4** | **AI as inline suggestions** — no explicit AI menu. Keyword/folder suggestions appear automatically as ghost text or inline chips when a snippet is untitled/uncategorized. Improve prompt is a right-click or ⌘⇧I. Batch reorg is a command. | ⚠️ |
| **B5** | **Minimal settings** — remove settings modal. Export path set on first export. Ollama URL auto-detected or set via env var. Keyboard style inferred from existing snippets. Only keep a small preferences popover for theme toggle. | ⚠️ |
| **B6** | **Strip pane theming** — same as A7. Single theme. | |
| **B7** | **Store consolidation** — more aggressive: snippet-store absorbs version-store (versions are per-snippet). playground-store absorbs ai-settings. sync-settings + sync-history merge. 9 → ~4 stores. | |

---

---

## C: Combined — Structural Redesign with Concrete Mechanisms

A's decomposition discipline + B's layout ambition, with all unknowns resolved.

| Part | Mechanism |
|------|-----------|
| **C1** | **Decompose page.tsx** — extract `AppShell` (layout + panel wiring), `useAppKeyboard` hook (all keyboard handlers), `useExportSync` hook (export/sync logic). page.tsx becomes ~200 lines of composition. |
| **C2** | **Two-panel layout with preview toggle** — remove dedicated preview panel. Editor gets a split-view toggle (side-by-side or bottom) like VS Code markdown preview. Playground opens as a slide-up drawer/sheet anchored to bottom of editor panel. Sidebar + editor are the two permanent panels. |
| **C3** | **Unified ⌘K palette** — one `cmdk`-based palette replaces all three. Default mode: fuzzy search snippets (current ⌘P behavior). Type `>` prefix to switch to commands (current ⌘K behavior). Type `/` prefix to search across snippet content (current ⌘⇧F). Same component, three modes, one shortcut. Cross-snippet results render inline in the palette as expandable groups (snippet name → matching lines). |
| **C4** | **AI actions submenu in palette** — type `>` then "ai" or bind ⌘J directly. Shows context-sensitive actions: "Suggest keyword" (only if keyword empty), "Suggest folder" (only if no folder), "Improve prompt" (only if text > 20 chars), "Reorganize folders" (always). Each action runs inline — keyword/folder suggestions appear as selectable results in the palette itself, not a separate popover. Improve prompt opens the existing review panel. |
| **C5** | **Clean editor header** — single row: snippet name (editable inline) | keyword pill (click to edit, empty state shows ghost "add keyword") | folder breadcrumb (click to change). No buttons, no toggles, no suggestions. Save indicator is a subtle dot on the snippet name (green = saved, orange = unsaved). |
| **C6** | **Minimal header bar** — left: sidebar toggle + app name. Right: 4 icons max — sync (combines import/export into a dropdown), settings, theme toggle, keyboard help. Export gets a dedicated ⌘⇧E shortcut but no permanent icon. History button moves into the editor's context menu or palette command. |
| **C7** | **Tabbed settings** — 3 tabs: General (theme, export path), AI (Ollama URL/model, meta-system prompt), Sync (intervals, file watcher, history). Remove keyword style config — infer from existing keywords via `deriveStyleGuide()` which already exists. Remove methodology preset — folder suggestions already work without it. |
| **C8** | **Strip pane theming** — delete PaneThemeProvider, PaneThemeToggle, and per-pane theme state. Single app-wide theme. |
| **C9** | **Consolidate stores** — merge ai-settings-store into snippet-store (it's just 3 fields). Merge sync-settings-store + sync-history-store into one sync-store. Delete keyword-style-store (infer at call site). Delete folder-methodology-store (unused after C7). 9 → 5 stores: snippet, playground, undo, version, sync. |

---

## Fit Check

| Req | Requirement | Status | A | B | C |
|-----|-------------|--------|---|---|---|
| R0 | Reduce cognitive load — app should feel like a focused tool, not a feature demo | Core goal | ✅ | ✅ | ✅ |
| R1 | page.tsx should be decomposed — 1100 lines mixing layout, handlers, export/sync logic | Must-have | ✅ | ✅ | ✅ |
| R2 | Consolidate search surfaces — 3 palettes into fewer entry points | Must-have | ✅ | ✅ | ✅ |
| R3 | AI features should have consistent, non-cluttered pattern | Must-have | ✅ | ❌ | ✅ |
| R4 | Editor header shouldn't be a junk drawer | Must-have | ✅ | ✅ | ✅ |
| R5 | Header bar icons need to be scannable | Must-have | ✅ | ✅ | ✅ |
| R6 | Per-pane theming adds complexity for marginal value | Nice-to-have | ✅ | ✅ | ✅ |
| R7 | Reduce store sprawl — 9 stores could be fewer | Nice-to-have | ✅ | ✅ | ✅ |
| R8 | Settings modal is a kitchen sink with no organization | Must-have | ✅ | ❌ | ✅ |

**Notes:**
- B fails R3: B4 has 4 flags — "inline suggestions appear automatically" is aspirational, no concrete mechanism
- B fails R8: B5 removes settings instead of organizing them — "auto-detect" and "infer from existing" have no fallback
- C passes all: resolves B's unknowns — AI actions via palette submenu (C4) instead of magic inline suggestions, tabbed settings (C7) instead of removal, unified palette with prefix modes (C3) instead of vague "single surface"

**Selected shape: C**

---

## Slices

### Dependency Graph

```
V1 (decompose + strip pane theming)
├── V2 (unified palette + AI actions)
│   └── V3 (clean editor header + minimal header bar)
├── V4 (two-panel layout)
└── V5 (tabbed settings + store consolidation)
```

V1 is foundation. V2-V5 can run in any order after V1, except V3 depends on V2.

---

### V1: Decompose & Strip — C1 + C8

Foundation slice. Same app, cleaner internals.

| What | Detail |
|------|--------|
| **C1** | Extract `AppShell` component (panel layout + wiring), `useAppKeyboard` hook (all hotkeys), `useExportSync` hook (export/sync/import logic). page.tsx becomes composition of these. |
| **C8** | Delete `PaneThemeProvider`, `PaneThemeToggle`, per-pane theme state from playground-store. Remove `<PaneThemeProvider>` wrappers from editor and preview panels. Single `<ThemeToggle>` remains in header. |

**Demo:** App looks identical. page.tsx is ~200 lines. No per-pane theme buttons.

**Deletes:** `PaneTheme.tsx`, per-pane theme fields in playground-store.

---

### V2: Unified Palette — C3 + C4

One ⌘K to rule them all.

| What | Detail |
|------|--------|
| **C3** | New `UnifiedPalette` component replaces `SearchPalette` + `CommandPalette` + `CrossSnippetSearch`. Single `cmdk` instance. Default: fuzzy snippet search. `>` prefix: command mode. `/` prefix: cross-snippet content search with inline expandable results. |
| **C4** | AI actions registered as commands with `>ai` prefix or ⌘J shortcut. Context-sensitive: "Suggest keyword" hidden if keyword exists, "Improve prompt" hidden if text < 20 chars. Keyword/folder suggestions render as selectable results inline. Improve prompt opens existing review panel. Batch reorg opens existing modal. |

**Demo:** ⌘K opens one palette. Type to find snippets, `>` for commands, `/` for content search, `>ai` or ⌘J for AI actions.

**Deletes:** `SearchPalette.tsx`, `CommandPalette.tsx`, `CrossSnippetSearch.tsx`, `KeywordSuggestions.tsx`, `FolderSuggestions.tsx`.

---

### V3: Declutter Chrome — C5 + C6

Clean up the two bars that frame the editor.

| What | Detail |
|------|--------|
| **C5** | Editor header becomes: snippet name (editable, click to rename) → keyword pill (click to edit, ghost "add keyword" when empty) → folder breadcrumb (click to reassign). No buttons, no toggles. Save state shown as colored dot on snippet name. |
| **C6** | Header bar: left = sidebar toggle + "Prompt Workbench". Right = 4 icons: sync dropdown (import + export + sync-to-raycast), settings, theme toggle, `?` help. History → palette command. Inline-preview toggle → palette command. |

**Demo:** Editor header is a clean metadata bar. App header has 4 icons.

**Deletes:** `ImprovePromptButton` from header (improve is now a palette AI action from V2). Sparkles button, suggestion components already deleted in V2. Export split-button, history button, conflict badge moved or removed from header.

---

### V4: Two-Panel Layout — C2

Biggest structural change. Preview becomes part of the editor.

| What | Detail |
|------|--------|
| **C2** | Remove the third panel. Editor panel gets a split toggle: off (editor only), right (side-by-side preview), bottom (stacked). Toggle via ⌘\\ or palette command. Playground opens as a bottom drawer/sheet within the editor panel, triggered by ⌘⇧R or palette. The `<Group>` layout becomes sidebar + editor only. |

**Demo:** Two panels. ⌘\\ toggles preview inline. ⌘⇧R slides up playground.

**Deletes:** Preview `<Panel>` and `<Separator>` from layout. Preview/Playground tab bar. `previewPanelRef` and collapse logic.

---

### V5: Settings & Stores — C7 + C9

Cleanup pass. No layout changes.

| What | Detail |
|------|--------|
| **C7** | Settings modal gets 3 tabs: **General** (theme, export path), **AI** (Ollama URL, model, meta-system prompt), **Sync** (intervals, file watcher, sync history). Delete keyword style config (use `deriveStyleGuide()` at call site). Delete methodology preset (folder suggestions work without it). |
| **C9** | Merge `ai-settings-store` fields (ollamaUrl, ollamaModel, metaSystemPrompt) into `snippet-store`. Merge `sync-settings-store` + `sync-history-store` into `sync-store`. Delete `keyword-style-store` and `folder-methodology` store. 9 → 5 stores. |

**Demo:** Settings modal has tabs. Fewer stores in devtools.

**Deletes:** `keyword-style-store.ts`, `folder-methodology.ts` (store file), `ai-settings-store.ts` (merged), `sync-settings-store.ts` + `sync-history-store.ts` (merged into `sync-store.ts`).
