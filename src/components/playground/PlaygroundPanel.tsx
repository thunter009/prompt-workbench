'use client'

import { MessageSquare } from 'lucide-react'

export function PlaygroundPanel() {
  return (
    <div className="h-full flex flex-col bg-muted">
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Select a snippet and run it</p>
        </div>
      </div>
    </div>
  )
}
