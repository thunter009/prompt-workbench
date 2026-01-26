'use client'

import { useState, useEffect, useCallback } from 'react'
import { Editor } from '@/components/editor/Editor'
import { Preview } from '@/components/preview/Preview'
import { ResizableDivider } from '@/components/ResizableDivider'

const STORAGE_KEY = 'prompt-workbench-content'
const DIVIDER_KEY = 'prompt-workbench-divider'
const DEFAULT_LEFT_PERCENT = 60

export default function HomePage() {
  const [content, setContent] = useState('')
  const [leftPercent, setLeftPercent] = useState(DEFAULT_LEFT_PERCENT)
  const [mounted, setMounted] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    const savedContent = localStorage.getItem(STORAGE_KEY)
    if (savedContent) setContent(savedContent)

    const savedDivider = localStorage.getItem(DIVIDER_KEY)
    if (savedDivider) {
      const parsed = parseFloat(savedDivider)
      if (!isNaN(parsed)) setLeftPercent(parsed)
    }

    setMounted(true)
  }, [])

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

  const handleResize = useCallback((percent: number) => {
    setLeftPercent(percent)
  }, [])

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="h-screen flex flex-col">
        <header className="border-b border-zinc-800 px-4 py-3">
          <h1 className="text-lg font-medium">Prompt Workbench</h1>
        </header>
        <div className="flex-1 flex overflow-hidden">
          <div style={{ width: `${leftPercent}%` }} className="overflow-auto">
            <Editor initialValue={content} onChange={setContent} />
          </div>
          <ResizableDivider onResize={handleResize} minLeftPx={200} minRightPx={200} />
          <div style={{ width: `${100 - leftPercent}%` }} className="overflow-auto">
            <Preview content={content} />
          </div>
        </div>
      </div>
    </main>
  )
}
