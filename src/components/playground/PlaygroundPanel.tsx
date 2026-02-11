'use client'

import { MessageSquare } from 'lucide-react'
import { useSnippetStore } from '@/lib/store'
import { TestValueInputs } from '@/components/playground/TestValueInputs'

export function PlaygroundPanel() {
  const snippet = useSnippetStore((s) => s.getSelectedSnippet())

  if (!snippet) {
    return (
      <div className="h-full flex flex-col bg-muted">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Select a snippet to test</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto p-4">
      <TestValueInputs snippetId={snippet.id} text={snippet.text} />
    </div>
  )
}
