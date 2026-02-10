'use client'

import { useSnippetStore } from '@/lib/store'
import { ChevronsRight, Plus, Search } from 'lucide-react'

interface SidebarRailProps {
  onExpand: () => void
  onOpenSearch: () => void
}

export function SidebarRail({ onExpand, onOpenSearch }: SidebarRailProps) {
  const createSnippet = useSnippetStore((s) => s.createSnippet)

  return (
    <div className="w-10 border-r border-border flex flex-col items-center py-2 gap-2 bg-muted/50">
      <button
        onClick={onExpand}
        className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
        title="Expand sidebar"
      >
        <ChevronsRight className="w-4 h-4" />
      </button>
      <button
        onClick={() => createSnippet({ name: 'New Snippet', text: '' })}
        className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
        title="New snippet"
      >
        <Plus className="w-4 h-4" />
      </button>
      <button
        onClick={onOpenSearch}
        className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
        title="Search (⌘P)"
      >
        <Search className="w-4 h-4" />
      </button>
    </div>
  )
}
