'use client'

import dynamic from 'next/dynamic'
import { EditorSkeleton } from './EditorSkeleton'

/**
 * Dynamically imported CodeMirror editor.
 * Reduces initial bundle by ~100KB+ by lazy-loading CodeMirror deps.
 */
export const EditorDynamic = dynamic(
  () => import('./Editor').then((mod) => mod.Editor),
  {
    loading: () => <EditorSkeleton />,
    ssr: false,
  }
)

export type { EditorProps } from './Editor'
