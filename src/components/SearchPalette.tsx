'use client'

import { useState, useEffect, useCallback } from 'react'
import { Command } from 'cmdk'
import { Search, FileText } from 'lucide-react'

interface SearchPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SearchPalette({ open, onOpenChange }: SearchPaletteProps) {
  const [search, setSearch] = useState('')

  // Reset search on close
  useEffect(() => {
    if (!open) {
      setSearch('')
    }
  }, [open])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onOpenChange(false)
      }
    },
    [onOpenChange]
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onClick={() => onOpenChange(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Dialog */}
      <Command
        className="relative w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        shouldFilter={false}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 border-b border-zinc-700">
          <Search className="w-5 h-5 text-zinc-500 shrink-0" />
          <Command.Input
            value={search}
            onValueChange={setSearch}
            placeholder="Search snippets..."
            autoFocus
            className="flex-1 h-12 bg-transparent text-zinc-100 placeholder:text-zinc-500 outline-none text-base"
          />
        </div>

        {/* Results */}
        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="py-8 text-center text-sm text-zinc-500">
            No snippets found
          </Command.Empty>

          {/* Placeholder for future US-2/US-4 - actual results will be added later */}
          <Command.Group heading="Snippets" className="text-xs font-medium text-zinc-500 px-2 py-1.5">
            <Command.Item
              value="placeholder"
              className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-zinc-300 data-[selected=true]:bg-zinc-800 data-[selected=true]:text-zinc-100"
            >
              <FileText className="w-4 h-4 text-zinc-500" />
              <span className="text-sm">Type to search...</span>
            </Command.Item>
          </Command.Group>
        </Command.List>

        {/* Footer hint */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-700 text-xs text-zinc-500">
          <div className="flex items-center gap-4">
            <span>
              <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-[10px] font-medium">↑↓</kbd> navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-[10px] font-medium">↵</kbd> open
            </span>
          </div>
          <span>
            <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-[10px] font-medium">esc</kbd> close
          </span>
        </div>
      </Command>
    </div>
  )
}
