# Epic: React Best Practices Improvements

Based on [Vercel Engineering React Best Practices](https://skills.sh/vercel-labs/agent-skills/vercel-react-best-practices)

## Summary

Review identified 12 improvement areas across 4 priority tiers. Focus on bundle optimization and re-render prevention for biggest wins.

---

## CRITICAL Priority

### 1. Add `optimizePackageImports` for lucide-react
**Rule:** `bundle-barrel-imports`
**Impact:** 200-800ms faster cold starts, faster dev HMR

**Current:** Barrel imports load entire library
```tsx
// src/app/page.tsx:29
import { PanelRight, PanelRightClose, Download, Settings, Zap, AlertTriangle, History, Check, Loader2 } from 'lucide-react'
```

**Fix:** Add to next.config.ts:
```ts
const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react']
  }
}
```

**Files affected:** next.config.ts
**Effort:** Trivial

---

### 2. Dynamic import for CodeMirror editor
**Rule:** `bundle-dynamic-imports`
**Impact:** Reduces initial JS bundle by ~100KB+

CodeMirror is heavy but only needed when editing. Load on demand.

**Current:**
```tsx
// src/components/editor/Editor.tsx
import { EditorState } from '@codemirror/state'
import { EditorView, ... } from '@codemirror/view'
```

**Fix:** Use next/dynamic with ssr:false:
```tsx
// src/app/page.tsx
import dynamic from 'next/dynamic'

const Editor = dynamic(
  () => import('@/components/editor/Editor').then(m => m.Editor),
  { ssr: false, loading: () => <EditorSkeleton /> }
)
```

**Files affected:** src/app/page.tsx, possibly new EditorSkeleton component
**Effort:** Small

---

### 3. Dynamic import for react-markdown + plugins
**Rule:** `bundle-dynamic-imports`
**Impact:** Reduces bundle by ~50KB+

Preview panel uses react-markdown, remark-gfm, rehype-raw. Not needed until preview is visible.

**Current:**
```tsx
// src/components/preview/Preview.tsx
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
```

**Fix:** Lazy load entire Preview component:
```tsx
// src/app/page.tsx
const Preview = dynamic(
  () => import('@/components/preview/Preview').then(m => m.Preview),
  { ssr: false }
)
```

**Files affected:** src/app/page.tsx
**Effort:** Small

---

## HIGH Priority

### 4. Preload editor/preview on hover
**Rule:** `bundle-preload`
**Impact:** Reduces perceived latency when toggling panels

**Fix:** Preload modules when user hovers toggle buttons:
```tsx
// src/app/page.tsx
const preloadEditor = () => {
  if (typeof window !== 'undefined') {
    void import('@/components/editor/Editor')
  }
}

const preloadPreview = () => {
  if (typeof window !== 'undefined') {
    void import('@/components/preview/Preview')
  }
}

<button
  onMouseEnter={preloadPreview}
  onClick={togglePreview}
>
```

**Files affected:** src/app/page.tsx
**Effort:** Trivial

---

### 5. Consolidate localStorage reads at mount
**Rule:** `client-localstorage-schema` + `js-cache-storage`
**Impact:** Fewer sync storage calls, cleaner hydration

**Current:** Multiple separate localStorage reads in useEffect:
```tsx
// src/app/page.tsx lines 142-172
const savedContent = localStorage.getItem(STORAGE_KEY)
const savedDivider = localStorage.getItem(DIVIDER_KEY)
const savedPreviewVisible = localStorage.getItem(PREVIEW_VISIBLE_KEY)
```

**Fix:** Single versioned read:
```ts
const STORAGE_VERSION = 1
const STORAGE_KEY = 'prompt-workbench-state'

interface PersistedState {
  version: number
  content: string
  dividerPercent: number
  previewVisible: boolean
}

function loadPersistedState(): Partial<PersistedState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const data = JSON.parse(raw)
    if (data.version !== STORAGE_VERSION) return {} // migration needed
    return data
  } catch {
    return {}
  }
}
```

**Files affected:** src/app/page.tsx, possibly new src/lib/persistence.ts
**Effort:** Medium

---

### 6. Use passive event listener for scroll sync
**Rule:** `client-passive-event-listeners`
**Impact:** Smoother scroll performance

**Current:**
```tsx
// src/components/editor/Editor.tsx:43
const scrollListener = EditorView.domEventHandlers({
  scroll: (event, view) => { ... }
})
```

**Fix:** Mark as passive (CodeMirror may already do this, verify). For Preview sync:
```tsx
// src/components/preview/Preview.tsx
useEffect(() => {
  const container = scrollContainerRef.current
  if (!container) return

  const handleScroll = () => { /* ... */ }
  container.addEventListener('scroll', handleScroll, { passive: true })
  return () => container.removeEventListener('scroll', handleScroll)
}, [])
```

**Files affected:** src/components/preview/Preview.tsx
**Effort:** Trivial

---

## MEDIUM Priority

### 7. Extract static JSX from Preview components
**Rule:** `rendering-hoist-jsx`
**Impact:** Fewer object allocations per render

**Current:** Markdown component definitions recreated each render (though memoized):
```tsx
// src/components/preview/Preview.tsx:54-187
const components = useMemo(() => ({
  h1: ({ children }) => (...)
  // ... many more
}), [])
```

**Fix:** Hoist outside component:
```tsx
const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-2xl font-bold mt-6 mb-4 text-zinc-100 border-b border-zinc-700 pb-2">{children}</h1>
  ),
  // ... rest
}

export function Preview({ content, scrollProgress }: PreviewProps) {
  // use markdownComponents directly
}
```

**Files affected:** src/components/preview/Preview.tsx
**Effort:** Small

---

### 8. Use useTransition for non-urgent updates
**Rule:** `rerender-transitions`
**Impact:** Smoother UI during expensive operations

**Current:** Direct state updates for content changes:
```tsx
// src/app/page.tsx
const handleEditorScroll = useCallback((progress: number) => {
  if (syncScroll) {
    setScrollProgress(progress)
  }
}, [syncScroll])
```

**Fix:** Wrap non-urgent updates:
```tsx
const [isPending, startTransition] = useTransition()

const handleEditorScroll = useCallback((progress: number) => {
  if (syncScroll) {
    startTransition(() => {
      setScrollProgress(progress)
    })
  }
}, [syncScroll])
```

**Files affected:** src/app/page.tsx
**Effort:** Small

---

### 9. Reduce Zustand selector granularity
**Rule:** `rerender-defer-reads`
**Impact:** Fewer re-renders from unrelated state changes

**Current:** Many fine-grained selectors in page.tsx cause re-renders:
```tsx
// src/app/page.tsx lines 52-79
const previewVisible = useSnippetStore((s) => s.previewVisible)
const togglePreview = useSnippetStore((s) => s.togglePreview)
const setPreviewVisible = useSnippetStore((s) => s.setPreviewVisible)
// ... 20+ more selectors
```

**Fix:** Group related selectors or use shallow comparison:
```tsx
import { useShallow } from 'zustand/react/shallow'

const { previewVisible, togglePreview, syncScroll } = useSnippetStore(
  useShallow((s) => ({
    previewVisible: s.previewVisible,
    togglePreview: s.togglePreview,
    syncScroll: s.syncScroll
  }))
)
```

**Files affected:** src/app/page.tsx
**Effort:** Medium

---

### 10. Extract keyboard handler to stable ref
**Rule:** `advanced-event-handler-refs`
**Impact:** Cleaner effect dependencies, fewer listener rebinds

**Current:**
```tsx
// src/app/page.tsx lines 309-334
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => { ... }
  document.addEventListener('keydown', handleKeyDown)
  return () => document.removeEventListener('keydown', handleKeyDown)
}, [togglePreview, handleQuickExport])
```

**Fix:** Use ref for handler to avoid rebinding:
```tsx
const handleKeyDownRef = useRef<(e: KeyboardEvent) => void>()

handleKeyDownRef.current = (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
    e.preventDefault()
    setSearchOpen(true)
  }
  // ...
}

useEffect(() => {
  const handler = (e: KeyboardEvent) => handleKeyDownRef.current?.(e)
  document.addEventListener('keydown', handler)
  return () => document.removeEventListener('keydown', handler)
}, []) // stable - never rebinds
```

**Files affected:** src/app/page.tsx
**Effort:** Small

---

## LOW Priority

### 11. Use functional setState for callbacks
**Rule:** `rerender-functional-setstate`
**Impact:** More stable callbacks, fewer dependency issues

**Current:**
```tsx
// src/app/page.tsx:371
onClick={() => setHistoryOpen((v) => !v)} // ✓ already good!
```

Most toggles already use functional form. Audit for any that don't.

**Files affected:** Various components
**Effort:** Trivial

---

### 12. Add content-visibility for long snippet lists
**Rule:** `rendering-content-visibility`
**Impact:** Faster paint for long lists

**Current:** Sidebar renders all snippets
**Fix:** Add CSS for items below fold:
```css
.snippet-item:nth-child(n+20) {
  content-visibility: auto;
  contain-intrinsic-size: auto 48px;
}
```

Or virtual list if snippet count grows large.

**Files affected:** src/components/Sidebar.tsx, possibly globals.css
**Effort:** Small

---

## Implementation Order

1. **Quick wins (< 1hr total):**
   - #1 optimizePackageImports
   - #4 preload on hover
   - #6 passive scroll listeners

2. **Bundle reduction (~2hr):**
   - #2 dynamic import Editor
   - #3 dynamic import Preview

3. **Performance polish (~2hr):**
   - #7 hoist static JSX
   - #8 useTransition
   - #10 keyboard handler ref

4. **Architecture (~3hr):**
   - #5 consolidated localStorage
   - #9 Zustand selector optimization

5. **Optional:**
   - #11 audit functional setState
   - #12 content-visibility

---

## Validation

After implementing, verify with:
```bash
# Bundle analysis
ANALYZE=true pnpm build

# Lighthouse performance
npx lighthouse http://localhost:3000 --view

# React DevTools Profiler
# Check re-render counts before/after
```
