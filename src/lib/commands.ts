'use client'

import { useMemo } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  FileText, FolderPlus, Copy, Trash2, Pencil,
  Eye, PanelLeft, Search, Joystick,
  Sparkles, Tags, FolderInput, Shuffle,
  RefreshCw, Upload,
  Settings, Moon, Keyboard,
} from 'lucide-react'

export type CommandSection = 'Snippets' | 'Navigation' | 'AI' | 'Sync' | 'Settings'

export interface Command {
  id: string
  label: string
  shortcut?: string
  icon?: LucideIcon
  section: CommandSection
  action: () => void
  disabled?: boolean
}

export const SECTION_ORDER: CommandSection[] = ['Snippets', 'Navigation', 'AI', 'Sync', 'Settings']

export interface CommandActions {
  // Snippets
  createSnippet: () => void
  createFolder: () => void
  duplicateSelected: () => void
  deleteSelected: () => void
  renameSelected: () => void
  // Navigation
  togglePreview: () => void
  toggleSidebar: () => void
  openSearch: () => void
  togglePlayground: () => void
  // AI
  improvePrompt: () => void
  suggestKeywords: () => void
  suggestFolder: () => void
  reorganizeFolders: () => void
  // Sync
  syncToRaycast: () => void
  importFromRaycast: () => void
  // Settings
  openSettings: () => void
  toggleDarkMode: () => void
  openShortcuts: () => void
  // State
  hasSelection: boolean
}

export function useCommands(actions: CommandActions): Command[] {
  const { hasSelection } = actions

  return useMemo((): Command[] => [
    // --- Snippets ---
    { id: 'new-snippet', label: 'New Snippet', shortcut: '⌘N', icon: FileText, section: 'Snippets', action: actions.createSnippet },
    { id: 'new-folder', label: 'New Folder', shortcut: '⌘⇧N', icon: FolderPlus, section: 'Snippets', action: actions.createFolder },
    { id: 'duplicate', label: 'Duplicate', shortcut: '⌘D', icon: Copy, section: 'Snippets', action: actions.duplicateSelected, disabled: !hasSelection },
    { id: 'delete', label: 'Delete Selected', icon: Trash2, section: 'Snippets', action: actions.deleteSelected, disabled: !hasSelection },
    { id: 'rename', label: 'Rename', shortcut: 'F2', icon: Pencil, section: 'Snippets', action: actions.renameSelected, disabled: !hasSelection },

    // --- Navigation ---
    { id: 'toggle-preview', label: 'Toggle Preview', shortcut: '⌘\\', icon: Eye, section: 'Navigation', action: actions.togglePreview },
    { id: 'toggle-sidebar', label: 'Toggle Sidebar', icon: PanelLeft, section: 'Navigation', action: actions.toggleSidebar },
    { id: 'search', label: 'Search', shortcut: '⌘P', icon: Search, section: 'Navigation', action: actions.openSearch },
    { id: 'toggle-playground', label: 'Toggle Playground', icon: Joystick, section: 'Navigation', action: actions.togglePlayground },

    // --- AI ---
    { id: 'improve-prompt', label: 'Improve Prompt', icon: Sparkles, section: 'AI', action: actions.improvePrompt, disabled: !hasSelection },
    { id: 'suggest-keywords', label: 'Suggest Keywords', icon: Tags, section: 'AI', action: actions.suggestKeywords, disabled: !hasSelection },
    { id: 'suggest-folder', label: 'Suggest Folder', icon: FolderInput, section: 'AI', action: actions.suggestFolder, disabled: !hasSelection },
    { id: 'reorganize-folders', label: 'Reorganize Folders', icon: Shuffle, section: 'AI', action: actions.reorganizeFolders },

    // --- Sync ---
    { id: 'sync-raycast', label: 'Sync to Raycast', shortcut: '⌘⇧S', icon: RefreshCw, section: 'Sync', action: actions.syncToRaycast },
    { id: 'import-raycast', label: 'Import from Raycast', icon: Upload, section: 'Sync', action: actions.importFromRaycast },

    // --- Settings ---
    { id: 'settings', label: 'Open Settings', shortcut: '⌘,', icon: Settings, section: 'Settings', action: actions.openSettings },
    { id: 'toggle-dark-mode', label: 'Toggle Dark Mode', icon: Moon, section: 'Settings', action: actions.toggleDarkMode },
    { id: 'shortcuts', label: 'Keyboard Shortcuts', shortcut: '⌘/', icon: Keyboard, section: 'Settings', action: actions.openShortcuts },
  ], [actions, hasSelection])
}
