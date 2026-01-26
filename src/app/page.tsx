'use client'

import { useState, useEffect } from 'react'
import { Editor } from '@/components/editor/Editor'
import { Preview } from '@/components/preview/Preview'

const STORAGE_KEY = 'prompt-workbench-content'

export default function HomePage() {
  const [content, setContent] = useState('')
  const [mounted, setMounted] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) setContent(saved)
    setMounted(true)
  }, [])

  // Persist to localStorage on change
  useEffect(() => {
    if (mounted) {
      localStorage.setItem(STORAGE_KEY, content)
    }
  }, [content, mounted])

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="h-screen flex flex-col">
        <header className="border-b border-zinc-800 px-4 py-3">
          <h1 className="text-lg font-medium">Prompt Workbench</h1>
        </header>
        <div className="flex-1 flex overflow-hidden">
          <div className="w-[60%] border-r border-zinc-800 overflow-auto">
            <Editor initialValue={content} onChange={setContent} />
          </div>
          <div className="w-[40%] overflow-auto">
            <Preview content={content} />
          </div>
        </div>
      </div>
    </main>
  )
}
