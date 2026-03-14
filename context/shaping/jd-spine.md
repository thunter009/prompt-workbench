---
shaping: true
---

# JD Spine — Shaping

## Source

> Shape an improvement to the batch reorg folder view — follow a strict Johnny Decimal index that is predefined (ideally with LLM assistants after user onboarding) that is used to sort snippets. Unsorted snippets go into an inbox by default except for archived and pinned snippets.
>
> Would love a rendered preview tooltip hover when in this view so I can quickly remember which snippet is what.
>
> We also don't have anything to auto delete the abandoned folders that were there from snippets that got moved to a better parent location. Maybe this doesn't matter if we move to more of an inbox or focus system where snippets can't be just hanging out in global root space.

---

## Problem

The current system has no structural backbone. Snippets float at root, folders accumulate organically from LLM suggestions with no hierarchy, empty folders linger after moves, and there's no way to distinguish "haven't sorted yet" from "intentionally placed here." The batch reorg suggests folders but doesn't enforce a system — you end up with 30+ flat folders and root-level noise.

## Outcome

A defined organizational spine (JD index) that every snippet gets filed into, with an inbox as the safe default, so the sidebar always looks intentional and navigable.

---

## Requirements (R)

| ID | Requirement | Status |
|----|-------------|--------|
| R0 | Every snippet lives in a JD category — no root-level orphans | Core goal |
| R1 | Predefined JD index (areas → categories) acts as the organizational spine | Core goal |
| R2 | JD index created via optional LLM-assisted wizard (not blocking first-run) | Must-have |
| R3 | Unsorted/new snippets land in Inbox by default | Must-have |
| R4 | Pinned and Archived snippets have distinct treatment (not inbox) | Nice-to-have (later slice) |
| R5 | Batch reorg files snippets into JD categories, not ad-hoc folder names | Must-have |
| R6 | Empty/abandoned folders cleaned up or prevented | Solved by design |
| R7 | Preview tooltip on hover in batch reorg view | Nice-to-have |
| R8 | JD index is editable after initial creation | Must-have |
| R9 | Migration: option to map existing folders → JD categories OR wipe and re-sort | Must-have |
| R10 | Sidebar toolbar icons visually consolidated (currently 6 → 4) | Nice-to-have |

---

## CURRENT

| Part | Mechanism |
|------|-----------|
| **C1** | Folders created ad-hoc (manually or from LLM suggestion) |
| **C2** | Snippets can be unfiled (root-level, no folderId) |
| **C3** | Batch reorg: LLM suggests folder *names*, user picks which to apply |
| **C4** | No inbox, pinned, or archived concepts |
| **C5** | Empty folders persist forever after snippets move out |
| **C6** | `folder-methodology.ts` has JD preset but only validates naming pattern |

---

## A: JD Spine with Inbox Default (Selected)

| Part | Mechanism |
|------|-----------|
| **A1** | **JD Index as data** — `jd_areas` (10-19, 20-29...) + `jd_categories` (11, 12...) tables. Existing `folders` table becomes children of categories or is replaced. |
| **A2** | **Optional onboarding wizard** — Trigger from sidebar or settings. LLM analyzes snippet names/content → proposes areas + categories. User reviews/edits/confirms. |
| **A3** | **Inbox (00.01)** — Reserved category, always visible at sidebar top. New + existing unfiled snippets default here. |
| **A4** | **Pinned flag** — *(later slice)* Boolean on snippet, renders in pinned section at top. |
| **A5** | **Archived flag** — *(later slice)* Boolean on snippet, hidden from default view. |
| **A6** | **Batch reorg → JD constrained** — LLM suggests JD category (not free-text). Can propose new categories within existing areas. |
| **A7** | **Sidebar: JD tree** — Areas → Categories → Snippets. Empty categories hidden. Inbox always at top. |
| **A8** | **Preview tooltip** — Hover on snippet row in batch reorg shows rendered markdown popover (~200 chars). |
| **A9** | **Index editor** — Modal or settings panel to add/rename/reorder areas and categories. |
| **A10** | **Migration flow** — When setting up JD index: choose "Map existing folders → JD categories (LLM-assisted)" or "Start fresh (move everything to Inbox)". |
| **A11** | **Toolbar consolidation** — Merge expand/collapse into single toggle. Batch reorg + index editor into overflow menu (⋯). Remove FolderPlus. Result: Filter, Expand/Collapse, ⋯, +. |

---

## Fit Check: R × A

| Req | Requirement | Status | A |
|-----|-------------|--------|---|
| R0 | Every snippet lives in a JD category — no root-level orphans | Core goal | ✅ |
| R1 | Predefined JD index (areas → categories) acts as the organizational spine | Core goal | ✅ |
| R2 | JD index created via optional LLM-assisted wizard (not blocking first-run) | Must-have | ✅ |
| R3 | Unsorted/new snippets land in Inbox by default | Must-have | ✅ |
| R4 | Pinned and Archived snippets have distinct treatment (not inbox) | Nice-to-have | ✅ |
| R5 | Batch reorg files snippets into JD categories, not ad-hoc folder names | Must-have | ✅ |
| R6 | Empty/abandoned folders cleaned up or prevented | Solved by design | ✅ |
| R7 | Preview tooltip on hover in batch reorg view | Nice-to-have | ✅ |
| R8 | JD index is editable after initial creation | Must-have | ✅ |
| R9 | Migration: option to map existing folders → JD categories OR wipe and re-sort | Must-have | ✅ |
| R10 | Sidebar toolbar icons visually consolidated (currently 6 → 4) | Nice-to-have | ✅ |

---

## Detail A: Breadboard

### Places

| # | Place | Description |
|---|-------|-------------|
| P1 | Sidebar | JD tree view, inbox at top, consolidated toolbar |
| P2 | JD Setup Wizard (Modal) | Optional onboarding — LLM proposes index from existing snippets |
| P2.1 | Migration Choice | Subplace: map existing folders vs start fresh |
| P2.2 | Index Review | Subplace: review/edit proposed areas + categories |
| P3 | Batch Reorg Modal | Updated: suggestions constrained to JD categories, preview tooltip |
| P4 | JD Index Editor (Modal) | Post-setup: add/rename/reorder areas and categories |
| P5 | Backend | API routes + DB tables |

### UI Affordances

| # | Place | Component | Affordance | Control | Wires Out | Returns To |
|---|-------|-----------|------------|---------|-----------|------------|
| U1 | P1 | sidebar-toolbar | Filter button | click | → N13 | — |
| U2 | P1 | sidebar-toolbar | Expand/Collapse toggle | click | → N14 | — |
| U3 | P1 | sidebar-toolbar | Overflow menu (⋯) | click | → U4, U5, U6 | — |
| U4 | P1 | overflow-menu | "Batch Reorganize" | click | → P3 | — |
| U5 | P1 | overflow-menu | "Edit JD Index" | click | → P4 | — |
| U6 | P1 | overflow-menu | "Set up JD Index" | click | → P2 | — |
| U7 | P1 | sidebar-toolbar | + New Snippet | click | → N15 | — |
| U8 | P1 | sidebar-tree | Inbox header (always visible, count badge) | render | — | — |
| U9 | P1 | sidebar-tree | Inbox snippet rows | render | — | — |
| U10 | P1 | sidebar-tree | JD Area headers (e.g. "10-19 Writing") | render | — | — |
| U11 | P1 | sidebar-tree | JD Category rows (e.g. "11 Email") | render | — | — |
| U12 | P1 | sidebar-tree | Snippet rows under categories | render | — | — |
| U20 | P2.1 | wizard | "Map existing folders to categories" radio | click | — | — |
| U21 | P2.1 | wizard | "Start fresh (move all to Inbox)" radio | click | — | — |
| U22 | P2 | wizard | "Analyze My Snippets" button | click | → N20 | — |
| U23 | P2 | wizard | Loading/progress indicator | render | — | — |
| U24 | P2.2 | wizard | Proposed areas list (editable names) | type | — | — |
| U25 | P2.2 | wizard | Proposed categories per area (editable) | type | — | — |
| U26 | P2.2 | wizard | Add area / Add category | click | — | — |
| U27 | P2.2 | wizard | Remove area / Remove category | click | — | — |
| U28 | P2 | wizard | Confirm & Apply | click | → N21 | — |
| U29 | P2 | wizard | Cancel | click | → P1 | — |
| U30 | P3 | reorg-modal | Snippet rows grouped by JD category | render | — | — |
| U31 | P3 | reorg-modal | Preview tooltip (hover → rendered markdown) | hover | → N31 | — |
| U32 | P3 | reorg-modal | Category dropdown (constrained to index) | click | — | — |
| U33 | P3 | reorg-modal | "Propose new category" in dropdown | click | → N32 | — |
| U34 | P3 | reorg-modal | Confidence dot (green/yellow) | render | — | — |
| U35 | P3 | reorg-modal | Inbox (unsorted) section | render | — | — |
| U36 | P3 | reorg-modal | Well-placed section | render | — | — |
| U37 | P3 | reorg-modal | Apply button | click | → N33 | — |
| U40 | P4 | index-editor | Area list with drag reorder | drag | → N40 | — |
| U41 | P4 | index-editor | Category list per area (drag reorder) | drag | → N40 | — |
| U42 | P4 | index-editor | Inline rename (area or category) | type | — | — |
| U43 | P4 | index-editor | Add area / Add category | click | — | — |
| U44 | P4 | index-editor | Delete area / Delete category | click | → N41 | — |
| U45 | P4 | index-editor | Save | click | → N42 | — |
| U46 | P4 | index-editor | Cancel | click | → P1 | — |

### Data Stores

| # | Place | Store | Description |
|---|-------|-------|-------------|
| S1 | P5 | `jd_areas` table | id, name, rangeStart, rangeEnd, orderIndex |
| S2 | P5 | `jd_categories` table | id, areaId, number, name, orderIndex |
| S3 | P5 | `snippets.categoryId` | FK to jd_categories — defaults to inbox (00.01) |
| S4 | P1 | `jdIndex` (Zustand) | Computed tree: areas → categories → snippet counts |
| S5 | P1 | `inboxSnippets` (Zustand) | Computed: snippets where categoryId === inbox |

### Code Affordances

| # | Place | Component | Affordance | Control | Wires Out | Returns To |
|---|-------|-----------|------------|---------|-----------|------------|
| N1 | P5 | api/jd-index | `POST /api/jd-index/generate` — LLM analyzes snippets, proposes index | call | → S1, S2 | → U24, U25 |
| N2 | P5 | api/jd-index | `PUT /api/jd-index` — save/update index | call | → S1, S2 | — |
| N3 | P5 | api/jd-index | `POST /api/jd-index/migrate` — map existing folders or inbox-all | call | → S3 | — |
| N4 | P5 | api/suggest-folder | `POST /api/suggest-folder` (updated) — constrained to JD categories | call | — | → U30 |
| N10 | P1 | sidebar | `loadJdIndex()` — read areas + categories from DB | call | — | → S4 |
| N11 | P1 | sidebar | `hasJdIndex` — computed boolean, controls U6 vs U5 visibility | computed | — | → U5, U6 |
| N12 | P1 | sidebar | `hideEmptyCategories()` — filter categories with 0 snippets | computed | — | → U11 |
| N13 | P1 | sidebar | `setExportFilter()` (existing) | call | — | → U9, U12 |
| N14 | P1 | sidebar | `toggleExpandAll()` (merged from expand+collapse) | call | — | → U10, U11 |
| N15 | P1 | sidebar | `createSnippet()` — new snippet defaults categoryId to inbox | call | → S3 | — |
| N20 | P2 | wizard | `analyzeSnippets()` — sends all snippet names/content to N1 | call | → N1 | → U23, U24, U25 |
| N21 | P2 | wizard | `applyIndex()` — saves index (N2) + runs migration (N3) | call | → N2, N3 | → P1 |
| N30 | P3 | reorg-modal | `suggestCategories()` — calls N4 for each snippet | call | → N4 | → U30, U34 |
| N31 | P3 | reorg-modal | `renderPreview()` — truncate + render markdown for tooltip | call | — | → U31 |
| N32 | P3 | reorg-modal | `proposeNewCategory()` — create category in existing area | call | → N2 | → U32 |
| N33 | P3 | reorg-modal | `applyMoves()` — update snippet.categoryId for selected | call | → S3 | → P1 |
| N40 | P4 | index-editor | `reorderIndex()` — update orderIndex on areas/categories | call | → S4 | — |
| N41 | P4 | index-editor | `deleteWithReassign()` — delete category, move snippets to inbox | call | → S2, S3 | — |
| N42 | P4 | index-editor | `saveIndex()` — persist all edits | call | → N2 | → P1 |

### Key Design Decisions

- **Toolbar**: 6 icons → 4. Expand/Collapse merged to toggle. Batch Reorg, Index Editor, JD Setup behind ⋯ overflow. FolderPlus removed.
- **U6 vs U5 conditional**: `hasJdIndex` (N11) controls whether overflow shows "Set up JD Index" or "Edit JD Index". Never both.
- **Delete with reassign (N41)**: Deleting a category moves its snippets to Inbox. No orphans ever.
- **Preview tooltip (U31)**: Non-blocking hover popover. Same Place (P3).
