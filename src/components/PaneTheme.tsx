'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'
import { dbClient } from '@/lib/db/client'

type PaneThemeValue = 'light' | 'dark' | 'global'

interface PaneThemeContextValue {
  paneTheme: PaneThemeValue
  resolvedPaneTheme: 'light' | 'dark'
  setPaneTheme: (theme: PaneThemeValue) => void
}

const PaneThemeContext = createContext<PaneThemeContextValue | null>(null)

function usePaneThemeContext() {
  const ctx = useContext(PaneThemeContext)
  if (!ctx) throw new Error('usePaneThemeContext requires PaneThemeProvider')
  return ctx
}

const SETTING_KEYS: Record<string, string> = {
  editor: 'editorTheme',
  preview: 'previewTheme',
}

/** Wraps a pane to scope dark/light theme independently via CSS class */
export function PaneThemeProvider({
  pane,
  children,
  className,
}: {
  pane: 'editor' | 'preview'
  children: React.ReactNode
  className?: string
}) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [paneTheme, setPaneThemeState] = useState<PaneThemeValue>('global')

  const settingKey = SETTING_KEYS[pane]

  // Load from DB on mount
  useEffect(() => {
    setMounted(true)
    dbClient.getSettings([settingKey]).then((settings) => {
      const stored = settings[settingKey] as string | undefined
      if (stored === 'light' || stored === 'dark') {
        setPaneThemeState(stored)
      }
    }).catch(() => {})
  }, [settingKey])

  const setPaneTheme = useCallback(
    (theme: PaneThemeValue) => {
      setPaneThemeState(theme)
      if (theme === 'global') {
        dbClient.saveSetting(settingKey, null)
      } else {
        dbClient.saveSetting(settingKey, theme)
      }
    },
    [settingKey],
  )

  const globalTheme = (resolvedTheme as 'light' | 'dark') ?? 'light'
  const resolvedPaneTheme = paneTheme === 'global' ? globalTheme : paneTheme

  // Before mount, don't apply scoped class (avoids hydration mismatch)
  if (!mounted) {
    return (
      <PaneThemeContext.Provider value={{ paneTheme: 'global', resolvedPaneTheme: 'light', setPaneTheme }}>
        <div className={className}>{children}</div>
      </PaneThemeContext.Provider>
    )
  }

  // Only add scoped theme class when pane overrides global
  const needsOverride = resolvedPaneTheme !== globalTheme

  return (
    <PaneThemeContext.Provider value={{ paneTheme, resolvedPaneTheme, setPaneTheme }}>
      <div
        className={cn(needsOverride && resolvedPaneTheme, className)}
        style={needsOverride ? { colorScheme: resolvedPaneTheme } : undefined}
      >
        {children}
      </div>
    </PaneThemeContext.Provider>
  )
}

/** Toggle button cycling: Match global → Light → Dark */
export function PaneThemeToggle() {
  const { paneTheme, setPaneTheme } = usePaneThemeContext()

  const cycle = useCallback(() => {
    const order: PaneThemeValue[] = ['global', 'light', 'dark']
    const next = order[(order.indexOf(paneTheme) + 1) % order.length]
    setPaneTheme(next)
  }, [paneTheme, setPaneTheme])

  const icon =
    paneTheme === 'light' ? (
      <Sun className="w-4 h-4" />
    ) : paneTheme === 'dark' ? (
      <Moon className="w-4 h-4" />
    ) : (
      <Monitor className="w-4 h-4" />
    )

  const title =
    paneTheme === 'global'
      ? 'Match global theme'
      : paneTheme === 'light'
        ? 'Light mode (pane override)'
        : 'Dark mode (pane override)'

  return (
    <button
      onClick={cycle}
      className={cn(
        'p-1.5 rounded hover:bg-accent transition-colors',
        paneTheme === 'global'
          ? 'text-muted-foreground hover:text-secondary-foreground'
          : 'text-blue-600 dark:text-blue-400',
      )}
      title={title}
    >
      {icon}
    </button>
  )
}
