'use client'

import dynamic from 'next/dynamic'
import { EditorSkeleton } from './EditorSkeleton'

const editorLoader = () => import('./Editor').then((mod) => mod.Editor)

/**
 * Dynamically imported CodeMirror editor.
 * Reduces initial bundle by ~100KB+ by lazy-loading CodeMirror deps.
 */
export const EditorDynamic = dynamic(editorLoader, {
  loading: () => <EditorSkeleton />,
  ssr: false,
})

/** Preload editor chunk on hover to reduce perceived latency */
export const preloadEditor = () => {
  void editorLoader()
}

export type { EditorProps } from './Editor'
