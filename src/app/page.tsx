'use client'

import { Editor } from '@/components/editor/Editor'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="h-screen flex flex-col">
        <header className="border-b border-zinc-800 px-4 py-3">
          <h1 className="text-lg font-medium">Prompt Workbench</h1>
        </header>
        <div className="flex-1 overflow-hidden">
          <Editor />
        </div>
      </div>
    </main>
  )
}
