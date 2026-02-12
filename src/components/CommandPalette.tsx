'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Command as CmdkRoot } from 'cmdk'
import { Search } from 'lucide-react'
import { type Command, SECTION_ORDER, type CommandSection } from '@/lib/commands'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  commands: Command[]
}

export function CommandPalette({ open, onOpenChange, commands }: CommandPaletteProps) {
  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  // Filter commands by search, hide disabled when searching
  const filtered = useMemo(() => {
    const visible = commands.filter((c) => !c.disabled)
    if (!search.trim()) return visible
    const q = search.toLowerCase()
    return visible.filter((c) => c.label.toLowerCase().includes(q))
  }, [commands, search])

  // Group filtered commands by section, preserving order
  const sections = useMemo(() => {
    const groups = new Map<CommandSection, Command[]>()
    for (const cmd of filtered) {
      const list = groups.get(cmd.section) ?? []
      list.push(cmd)
      groups.set(cmd.section, list)
    }
    return SECTION_ORDER
      .filter((s) => groups.has(s))
      .map((s) => ({ section: s, commands: groups.get(s)! }))
  }, [filtered])

  // Flat list for keyboard navigation
  const flatItems = useMemo(() => sections.flatMap((s) => s.commands), [sections])

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
    if (!list || flatItems.length === 0) return
    const items = list.querySelectorAll('[data-command-item]')
    const selected = items[selectedIndex] as HTMLElement | undefined
    selected?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex, flatItems.length])

  const execute = useCallback(
    (index: number) => {
      const cmd = flatItems[index]
      if (!cmd) return
      cmd.action()
      onOpenChange(false)
    },
    [flatItems, onOpenChange]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onOpenChange(false)
        return
      }

      if (flatItems.length === 0) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((i) => (i + 1) % flatItems.length)
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((i) => (i - 1 + flatItems.length) % flatItems.length)
          break
        case 'Enter':
          e.preventDefault()
          execute(selectedIndex)
          break
      }
    },
    [flatItems.length, selectedIndex, execute, onOpenChange]
  )

  if (!open) return null

  // Build flat index counter for aria-selected
  let flatIdx = 0

  return (
    <div
      data-testid="command-palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onClick={() => onOpenChange(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-overlay-in" />

      {/* Dialog */}
      <CmdkRoot
        className="relative w-full max-w-lg mx-4 sm:mx-0 bg-muted border border-border rounded-xl shadow-2xl overflow-hidden animate-modal-in"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        shouldFilter={false}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 border-b border-border">
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <CmdkRoot.Input
            value={search}
            onValueChange={setSearch}
            placeholder="Type a command..."
            autoFocus
            className="flex-1 h-12 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-base"
          />
        </div>

        {/* Command list */}
        <CmdkRoot.List ref={listRef} role="listbox" className="max-h-80 overflow-y-auto p-2">
          {flatItems.length === 0 ? (
            <CmdkRoot.Empty className="py-8 text-center text-sm text-muted-foreground">
              No matching commands
            </CmdkRoot.Empty>
          ) : (
            sections.map((group) => {
              const items = group.commands.map((cmd) => {
                const idx = flatIdx++
                const Icon = cmd.icon
                return (
                  <div
                    key={cmd.id}
                    data-command-item
                    role="option"
                    aria-selected={idx === selectedIndex}
                    onClick={() => execute(idx)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer text-secondary-foreground transition-colors ${
                      idx === selectedIndex ? 'bg-blue-600/30 text-blue-200' : 'hover:bg-accent/50'
                    }`}
                  >
                    {Icon && <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />}
                    <span className="text-sm flex-1">{cmd.label}</span>
                    {cmd.shortcut && (
                      <kbd className="text-xs text-muted-foreground px-1.5 py-0.5 bg-accent rounded">
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </div>
                )
              })

              return (
                <div key={group.section} data-command-section={group.section}>
                  <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {group.section}
                  </div>
                  {items}
                </div>
              )
            })
          )}
        </CmdkRoot.List>

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
      </CmdkRoot>
    </div>
  )
}
