---
shaping: true
---

# JD Spine — Slices

Parent: [jd-spine.md](jd-spine.md)

## Slice Summary

| # | Slice | Parts | Demo |
|---|-------|-------|------|
| V1 | JD Index + Sidebar + Inbox | A1, A3, A7, A9 | "Sidebar shows JD tree with inbox at top; create/edit areas and categories in index editor" |
| V2 | Toolbar Consolidation | A11 | "Toolbar is 4 icons; reorg and index live in overflow menu" |
| V3 | JD-Constrained Batch Reorg | A6 | "Batch reorg suggests JD categories, not free-text names" |
| V4 | Preview Tooltip | A8 | "Hover snippet in reorg → rendered markdown preview" |
| V5 | Setup Wizard + Migration | A2, A10 | "LLM analyzes snippets, proposes JD index; choose map-folders or inbox-all" |

**Dependencies:**
- V2 depends on V1 (overflow menu wires to index editor)
- V3 depends on V1 (reorg needs JD categories to exist)
- V4 depends on V3 (tooltip lives inside reorg modal)
- V5 depends on V1 (wizard saves via same PUT endpoint)
- V2 and V3 are independent — could be built in parallel

---

## V1: JD Index + Sidebar + Inbox

The foundation. Manual index creation via editor, sidebar renders JD tree, inbox is the default home.

### UI Affordances

| # | Place | Component | Affordance | Control | Wires Out | Returns To |
|---|-------|-----------|------------|---------|-----------|------------|
| U8 | P1 | sidebar-tree | Inbox header (always visible, count) | render | — | — |
| U9 | P1 | sidebar-tree | Inbox snippet rows | render | — | — |
| U10 | P1 | sidebar-tree | JD Area headers | render | — | — |
| U11 | P1 | sidebar-tree | JD Category rows | render | — | — |
| U12 | P1 | sidebar-tree | Snippet rows under categories | render | — | — |
| U40 | P4 | index-editor | Area list (drag reorder) | drag | → N40 | — |
| U41 | P4 | index-editor | Category list per area (drag) | drag | → N40 | — |
| U42 | P4 | index-editor | Inline rename | type | — | — |
| U43 | P4 | index-editor | Add area / Add category | click | — | — |
| U44 | P4 | index-editor | Delete (→ moves snippets to inbox) | click | → N41 | — |
| U45 | P4 | index-editor | Save | click | → N42 | — |
| U46 | P4 | index-editor | Cancel | click | → P1 | — |

### Code Affordances

| # | Place | Component | Affordance | Control | Wires Out | Returns To |
|---|-------|-----------|------------|---------|-----------|------------|
| N2 | P5 | api/jd-index | `PUT /api/jd-index` — save index | call | → S1, S2 | — |
| N10 | P1 | sidebar | `loadJdIndex()` | call | — | → S4 |
| N12 | P1 | sidebar | `hideEmptyCategories()` | computed | — | → U11 |
| N15 | P1 | sidebar | `createSnippet()` → inbox default | call | → S3 | — |
| N40 | P4 | index-editor | `reorderIndex()` | call | → S4 | — |
| N41 | P4 | index-editor | `deleteWithReassign()` → inbox | call | → S2, S3 | — |
| N42 | P4 | index-editor | `saveIndex()` | call | → N2 | → P1 |

### Data Stores

| # | Place | Store | Description |
|---|-------|-------|-------------|
| S1 | P5 | `jd_areas` | id, name, rangeStart, rangeEnd, orderIndex |
| S2 | P5 | `jd_categories` | id, areaId, number, name, orderIndex |
| S3 | P5 | `snippets.categoryId` | FK → jd_categories, defaults to inbox |
| S4 | P1 | `jdIndex` (Zustand) | Computed tree: areas → categories → counts |
| S5 | P1 | `inboxSnippets` (Zustand) | Computed: categoryId === inbox |

---

## V2: Toolbar Consolidation

Visual cleanup. Merge expand/collapse, add overflow menu, remove FolderPlus.

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

### Code Affordances

| # | Place | Component | Affordance | Control | Wires Out | Returns To |
|---|-------|-----------|------------|---------|-----------|------------|
| N11 | P1 | sidebar | `hasJdIndex` — controls U5 vs U6 | computed | — | → U5, U6 |
| N13 | P1 | sidebar | `setExportFilter()` (existing) | call | — | → U9, U12 |
| N14 | P1 | sidebar | `toggleExpandAll()` (merged) | call | — | → U10, U11 |

---

## V3: JD-Constrained Batch Reorg

LLM suggests JD categories instead of free-text folder names. Can propose new categories within existing areas.

### UI Affordances

| # | Place | Component | Affordance | Control | Wires Out | Returns To |
|---|-------|-----------|------------|---------|-----------|------------|
| U30 | P3 | reorg-modal | Snippet rows grouped by JD category | render | — | — |
| U32 | P3 | reorg-modal | Category dropdown (constrained to index) | click | — | — |
| U33 | P3 | reorg-modal | "Propose new category" in dropdown | click | → N32 | — |
| U34 | P3 | reorg-modal | Confidence dot | render | — | — |
| U35 | P3 | reorg-modal | Inbox (unsorted) section | render | — | — |
| U36 | P3 | reorg-modal | Well-placed section | render | — | — |
| U37 | P3 | reorg-modal | Apply | click | → N33 | — |

### Code Affordances

| # | Place | Component | Affordance | Control | Wires Out | Returns To |
|---|-------|-----------|------------|---------|-----------|------------|
| N4 | P5 | api/suggest-folder | `POST /api/suggest-folder` (JD-constrained) | call | — | → U30, U34 |
| N30 | P3 | reorg-modal | `suggestCategories()` | call | → N4 | → U30, U34 |
| N32 | P3 | reorg-modal | `proposeNewCategory()` | call | → N2 | → U32 |
| N33 | P3 | reorg-modal | `applyMoves()` → update categoryId | call | → S3 | → P1 |

---

## V4: Preview Tooltip

Hover on any snippet row in batch reorg to see rendered markdown preview.

### UI Affordances

| # | Place | Component | Affordance | Control | Wires Out | Returns To |
|---|-------|-----------|------------|---------|-----------|------------|
| U31 | P3 | reorg-modal | Preview tooltip (hover → markdown popover) | hover | → N31 | — |

### Code Affordances

| # | Place | Component | Affordance | Control | Wires Out | Returns To |
|---|-------|-----------|------------|---------|-----------|------------|
| N31 | P3 | reorg-modal | `renderPreview()` — truncate + render markdown | call | — | → U31 |

---

## V5: Setup Wizard + Migration

LLM-assisted onboarding. Analyzes existing snippets, proposes JD index. User chooses to map existing folders or start fresh.

### UI Affordances

| # | Place | Component | Affordance | Control | Wires Out | Returns To |
|---|-------|-----------|------------|---------|-----------|------------|
| U20 | P2.1 | wizard | "Map existing folders to categories" radio | click | — | — |
| U21 | P2.1 | wizard | "Start fresh (move all to Inbox)" radio | click | — | — |
| U22 | P2 | wizard | "Analyze My Snippets" button | click | → N20 | — |
| U23 | P2 | wizard | Loading/progress indicator | render | — | — |
| U24 | P2.2 | wizard | Proposed areas list (editable) | type | — | — |
| U25 | P2.2 | wizard | Proposed categories per area (editable) | type | — | — |
| U26 | P2.2 | wizard | Add area / Add category | click | — | — |
| U27 | P2.2 | wizard | Remove area / Remove category | click | — | — |
| U28 | P2 | wizard | Confirm & Apply | click | → N21 | — |
| U29 | P2 | wizard | Cancel | click | → P1 | — |

### Code Affordances

| # | Place | Component | Affordance | Control | Wires Out | Returns To |
|---|-------|-----------|------------|---------|-----------|------------|
| N1 | P5 | api/jd-index | `POST /api/jd-index/generate` — LLM proposes index | call | — | → U24, U25 |
| N3 | P5 | api/jd-index | `POST /api/jd-index/migrate` — map folders or inbox-all | call | → S3 | — |
| N20 | P2 | wizard | `analyzeSnippets()` | call | → N1 | → U23, U24, U25 |
| N21 | P2 | wizard | `applyIndex()` — saves + migrates | call | → N2, N3 | → P1 |
