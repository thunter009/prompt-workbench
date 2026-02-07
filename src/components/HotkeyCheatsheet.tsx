'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'

interface HotkeyCheatsheetProps {
  open: boolean
  onClose: () => void
}

const HOTKEYS = [
  { section: 'General', keys: [
    { key: '⌘ ,', description: 'Open settings' },
    { key: '⌘ P', description: 'Search snippets' },
    { key: '⌘ ?', description: 'Show this cheatsheet' },
  ]},
  { section: 'Editor', keys: [
    { key: '⌘ \\', description: 'Toggle preview panel' },
    { key: '⌘ K', description: 'Suggest keyword' },
  ]},
  { section: 'Sync', keys: [
    { key: '⌘ ⇧ S', description: 'Sync to Raycast (export + auto-import)' },
    { key: '⌘ ⇧ E', description: 'Quick export to ~/.prompt-workbench' },
  ]},
]

export function HotkeyCheatsheet({ open, onClose }: HotkeyCheatsheetProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-overlay-in" onClick={onClose} />

      <div className="relative bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl max-w-md w-full mx-4 animate-modal-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-medium">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {HOTKEYS.map((section) => (
            <div key={section.section}>
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
                {section.section}
              </h3>
              <div className="space-y-2">
                {section.keys.map((hotkey) => (
                  <div key={hotkey.key} className="flex items-center justify-between">
                    <span className="text-sm text-zinc-300">{hotkey.description}</span>
                    <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs font-mono text-zinc-400">
                      {hotkey.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
