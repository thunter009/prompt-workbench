'use client'

import { useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, lineNumbers } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { unifiedMergeView, MergeView } from '@codemirror/merge'
import { raycastPlaceholderExtension } from '@/components/editor/raycast-placeholder-language'

export interface DiffMergeViewProps {
  original: string
  modified: string
}

const sharedExtensions = [
  markdown({ base: markdownLanguage }),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  raycastPlaceholderExtension,
  EditorState.readOnly.of(true),
  EditorView.editable.of(false),
]

const diffTheme = EditorView.theme({
  '&': {
    fontSize: '12px',
    backgroundColor: 'hsl(var(--background))',
  },
  '.cm-content': {
    fontFamily: 'ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace',
    padding: '8px 0',
  },
  '.cm-line': {
    padding: '0 8px',
  },
  '.cm-gutters': {
    backgroundColor: 'hsl(var(--background))',
    color: 'hsl(var(--muted-foreground))',
    border: 'none',
    minWidth: '2.5em',
  },
  // Unified merge view styles
  '.cm-deletedChunk': {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  '.cm-changedLine': {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  '.cm-changedText': {
    backgroundColor: 'rgba(34, 197, 94, 0.25)',
  },
  '.cm-deletedChunk .cm-changedText': {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
  },
})

/** Unified inline diff - single editor showing changes between original and modified */
export function DiffMergeView({ original, modified }: DiffMergeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const state = EditorState.create({
      doc: modified,
      extensions: [
        lineNumbers(),
        ...sharedExtensions,
        unifiedMergeView({
          original,
          highlightChanges: true,
          gutter: true,
          syntaxHighlightDeletions: true,
          mergeControls: false,
          collapseUnchanged: { margin: 3, minSize: 4 },
        }),
        diffTheme,
      ],
    })

    const view = new EditorView({
      state,
      parent: containerRef.current,
    })

    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [original, modified])

  return <div ref={containerRef} className="h-full overflow-auto" />
}

const sideBySideTheme = EditorView.theme({
  '&': {
    fontSize: '12px',
    backgroundColor: 'hsl(var(--background))',
  },
  '.cm-content': {
    fontFamily: 'ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace',
    padding: '8px 0',
  },
  '.cm-line': {
    padding: '0 8px',
  },
  '.cm-gutters': {
    backgroundColor: 'hsl(var(--background))',
    color: 'hsl(var(--muted-foreground))',
    border: 'none',
    minWidth: '2.5em',
  },
})

/** Side-by-side merge view for wider contexts */
export function SideBySideMergeView({ original, modified }: DiffMergeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mergeViewRef = useRef<MergeView | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const view = new MergeView({
      a: {
        doc: original,
        extensions: [lineNumbers(), ...sharedExtensions, sideBySideTheme],
      },
      b: {
        doc: modified,
        extensions: [lineNumbers(), ...sharedExtensions, sideBySideTheme],
      },
      parent: containerRef.current,
      highlightChanges: true,
      gutter: true,
      collapseUnchanged: { margin: 3, minSize: 4 },
    })

    mergeViewRef.current = view

    return () => {
      view.destroy()
      mergeViewRef.current = null
    }
  }, [original, modified])

  return (
    <div
      ref={containerRef}
      className="h-full overflow-auto [&_.cm-mergeView]:h-full"
    />
  )
}
