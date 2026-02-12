'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Command } from 'cmdk'
import { Search } from 'lucide-react'

export interface CommandItem {
  id: string
  label: string
  shortcut?: string
  onSelect: () => void
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  commands: CommandItem[]
}

export function CommandPalette({ open, onOpenChange, commands }: CommandPaletteProps) {
  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  // Filter commands by search
  const filtered = search.trim()
    ? commands.filter((c) => c.label.toLowerCase().includes(search.toLowerCase()))
    : commands

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSearch('')
      setSelectedIndex(0)
    }
  }, [open])

  // Reset selection when filtered list changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [search])

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current
    if (!list || filtered.length === 0) return
    const items = list.querySelectorAll('[data-command-item]')
    const selected = items[selectedIndex] as HTMLElement | undefined
    selected?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex, filtered.length])

  const execute = useCallback(
    (index: number) => {
      const cmd = filtered[index]
      if (!cmd) return
      cmd.onSelect()
      onOpenChange(false)
    },
    [filtered, onOpenChange]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onOpenChange(false)
        return
      }

      if (filtered.length === 0) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((i) => (i + 1) % filtered.length)
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length)
          break
        case 'Enter':
          e.preventDefault()
          execute(selectedIndex)
          break
      }
    },
    [filtered.length, selectedIndex, execute, onOpenChange]
  )

  if (!open) return null

  return (
    <div
      data-testid="command-palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onClick={() => onOpenChange(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-overlay-in" />

      {/* Dialog */}
      <Command
        className="relative w-full max-w-lg mx-4 sm:mx-0 bg-muted border border-border rounded-xl shadow-2xl overflow-hidden animate-modal-in"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        shouldFilter={false}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 border-b border-border">
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <Command.Input
            value={search}
            onValueChange={setSearch}
            placeholder="Type a command..."
            autoFocus
            className="flex-1 h-12 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-base"
          />
        </div>

        {/* Command list */}
        <Command.List ref={listRef} role="listbox" className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
              No matching commands
            </Command.Empty>
          ) : (
            filtered.map((cmd, index) => (
              <div
                key={cmd.id}
                data-command-item
                role="option"
                aria-selected={index === selectedIndex}
                onClick={() => execute(index)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer text-secondary-foreground transition-colors ${
                  index === selectedIndex ? 'bg-blue-600/30 text-blue-200' : 'hover:bg-accent/50'
                }`}
              >
                <span className="text-sm">{cmd.label}</span>
                {cmd.shortcut && (
                  <kbd className="text-xs text-muted-foreground px-1.5 py-0.5 bg-accent rounded">
                    {cmd.shortcut}
                  </kbd>
                )}
              </div>
            ))
          )}
        </Command.List>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-xs text-muted-foreground">
          <span>
            <kbd className="px-1.5 py-0.5 bg-accent rounded text-[10px] font-medium">↑↓</kbd> navigate
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-accent rounded text-[10px] font-medium">↵</kbd> execute
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-accent rounded text-[10px] font-medium">esc</kbd> close
          </span>
        </div>
      </Command>
    </div>
  )
}
