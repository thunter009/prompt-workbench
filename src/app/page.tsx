'use client'

import { useState, useEffect, useCallback } from 'react'
import { Editor } from '@/components/editor/Editor'
import { Preview } from '@/components/preview/Preview'
import { ResizableDivider } from '@/components/ResizableDivider'
import { useSnippetStore } from '@/lib/store'
import { PanelRight, PanelRightClose } from 'lucide-react'

const STORAGE_KEY = 'prompt-workbench-content'
const DIVIDER_KEY = 'prompt-workbench-divider'
const PREVIEW_VISIBLE_KEY = 'prompt-workbench-preview-visible'
const DEFAULT_LEFT_PERCENT = 60

export default function HomePage() {
  const [content, setContent] = useState('')
  const [leftPercent, setLeftPercent] = useState(DEFAULT_LEFT_PERCENT)
  const [mounted, setMounted] = useState(false)

  const previewVisible = useSnippetStore((s) => s.previewVisible)
  const togglePreview = useSnippetStore((s) => s.togglePreview)
  const setPreviewVisible = useSnippetStore((s) => s.setPreviewVisible)

  // Load from localStorage on mount
  useEffect(() => {
    const savedContent = localStorage.getItem(STORAGE_KEY)
    if (savedContent) setContent(savedContent)

    const savedDivider = localStorage.getItem(DIVIDER_KEY)
    if (savedDivider) {
      const parsed = parseFloat(savedDivider)
      if (!isNaN(parsed)) setLeftPercent(parsed)
    }

    const savedPreviewVisible = localStorage.getItem(PREVIEW_VISIBLE_KEY)
    if (savedPreviewVisible !== null) {
      setPreviewVisible(savedPreviewVisible === 'true')
    }

    setMounted(true)
  }, [setPreviewVisible])

  // Persist content to localStorage
  useEffect(() => {
    if (mounted) {
      localStorage.setItem(STORAGE_KEY, content)
    }
  }, [content, mounted])

  // Persist divider position to localStorage
  useEffect(() => {
    if (mounted) {
      localStorage.setItem(DIVIDER_KEY, String(leftPercent))
    }
  }, [leftPercent, mounted])

  // Persist preview visibility to localStorage
  useEffect(() => {
    if (mounted) {
      localStorage.setItem(PREVIEW_VISIBLE_KEY, String(previewVisible))
    }
  }, [previewVisible, mounted])

  // Keyboard shortcut: Cmd+\ to toggle preview
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault()
        togglePreview()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [togglePreview])

  const handleResize = useCallback((percent: number) => {
    setLeftPercent(percent)
  }, [])

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="h-screen flex flex-col">
        <header className="border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-medium">Prompt Workbench</h1>
          <button
            onClick={togglePreview}
            className="p-2 rounded hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-200"
            title={previewVisible ? 'Hide preview (⌘\\)' : 'Show preview (⌘\\)'}
          >
            {previewVisible ? (
              <PanelRightClose className="w-5 h-5" />
            ) : (
              <PanelRight className="w-5 h-5" />
            )}
          </button>
        </header>
        <div className="flex-1 flex overflow-hidden">
          <div
            style={{ width: previewVisible ? `${leftPercent}%` : '100%' }}
            className="overflow-auto transition-[width] duration-200 ease-out"
          >
            <Editor initialValue={content} onChange={setContent} />
          </div>
          {previewVisible && (
            <>
              <ResizableDivider onResize={handleResize} minLeftPx={200} minRightPx={200} />
              <div
                style={{ width: `${100 - leftPercent}%` }}
                className="overflow-auto transition-[width] duration-200 ease-out"
              >
                <Preview content={content} />
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
