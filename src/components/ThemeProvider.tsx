'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'

// next-themes persists to localStorage key "theme" and uses
// prefers-color-scheme media query when defaultTheme="system"
const THEME_STORAGE_KEY = 'theme' // localStorage theme key used by next-themes

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey={THEME_STORAGE_KEY}
    >
      {children}
    </NextThemesProvider>
  )
}
