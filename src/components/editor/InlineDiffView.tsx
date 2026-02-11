'use client'

import { useState, lazy, Suspense } from 'react'
import { GitCompare, Columns2, Rows2, X, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { computeLineDiff } from '@/lib/diff'

const DiffMergeView = lazy(() =>
  import('@/components/editor/DiffMergeView').then((m) => ({ default: m.DiffMergeView }))
)
const SideBySideMergeView = lazy(() =>
  import('@/components/editor/DiffMergeView').then((m) => ({ default: m.SideBySideMergeView }))
)

export interface DiffComparison {
  original: string
  modified: string
  originalLabel: string
  modifiedLabel: string
  onRestore?: () => void
  onClose: () => void
}

type DiffLayout = 'unified' | 'split'

export function InlineDiffView({ original, modified, originalLabel, modifiedLabel, onRestore, onClose }: DiffComparison) {
  const [layout, setLayout] = useState<DiffLayout>('unified')

  const diff = computeLineDiff(original, modified)

  return (
    <div className="flex flex-col h-full">
      {/* Diff toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/50 shrink-0">
        <div className="flex items-center gap-3">
          <GitCompare className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {originalLabel}
          </span>
          <span className="text-xs text-muted-foreground">→</span>
          <span className="text-xs text-muted-foreground">
            {modifiedLabel}
          </span>
          <span className="flex items-center gap-1 text-[10px]">
            {diff.addedLines > 0 && <span className="text-green-400">+{diff.addedLines}</span>}
            {diff.removedLines > 0 && <span className="text-red-400">-{diff.removedLines}</span>}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* Layout toggle */}
          <button
            onClick={() => setLayout('unified')}
            className={cn(
              'p-1 rounded transition-colors',
              layout === 'unified'
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-secondary-foreground'
            )}
            title="Unified view"
          >
            <Rows2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setLayout('split')}
            className={cn(
              'p-1 rounded transition-colors',
              layout === 'split'
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-secondary-foreground'
            )}
            title="Split view"
          >
            <Columns2 className="w-3.5 h-3.5" />
          </button>
          {onRestore && (
            <button
              onClick={onRestore}
              className="flex items-center gap-1 ml-2 px-2 py-0.5 text-xs text-green-400 hover:text-green-300 rounded hover:bg-accent transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Restore
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 ml-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Close diff"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Diff content */}
      <div className="flex-1 overflow-auto">
        <Suspense fallback={<div className="p-4 text-xs text-muted-foreground">Loading diff...</div>}>
          {layout === 'unified' ? (
            <DiffMergeView original={original} modified={modified} />
          ) : (
            <SideBySideMergeView original={original} modified={modified} />
          )}
        </Suspense>
      </div>
    </div>
  )
}
