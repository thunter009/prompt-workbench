import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type MethodologyPreset = 'flat' | 'para' | 'johnny-decimal' | 'custom'

export interface MethodologyConfig {
  preset: MethodologyPreset
  customTopLevel: string[]
}

const PARA_FOLDERS = ['Projects', 'Areas', 'Resources', 'Archive'] as const

interface MethodologyStore {
  config: MethodologyConfig
  setPreset: (preset: MethodologyPreset) => void
  setCustomTopLevel: (folders: string[]) => void
  addCustomFolder: (name: string) => void
  removeCustomFolder: (name: string) => void
}

export const useMethodologyStore = create<MethodologyStore>()(
  persist(
    (set) => ({
      config: {
        preset: 'flat',
        customTopLevel: [],
      },

      setPreset: (preset) =>
        set((state) => ({ config: { ...state.config, preset } })),

      setCustomTopLevel: (folders) =>
        set((state) => ({ config: { ...state.config, customTopLevel: folders } })),

      addCustomFolder: (name) =>
        set((state) => ({
          config: {
            ...state.config,
            customTopLevel: state.config.customTopLevel.includes(name)
              ? state.config.customTopLevel
              : [...state.config.customTopLevel, name],
          },
        })),

      removeCustomFolder: (name) =>
        set((state) => ({
          config: {
            ...state.config,
            customTopLevel: state.config.customTopLevel.filter((f) => f !== name),
          },
        })),
    }),
    {
      name: 'prompt-workbench-folder-methodology',
    }
  )
)

export function getMethodologyPromptContext(config?: MethodologyConfig): string {
  const c = config ?? useMethodologyStore.getState().config

  switch (c.preset) {
    case 'flat':
      return ''

    case 'para':
      return [
        'The user follows the PARA methodology.',
        `Top-level folders MUST be one of: ${PARA_FOLDERS.join(', ')}.`,
        'Suggest subfolders within these categories only.',
      ].join(' ')

    case 'johnny-decimal':
      return [
        'The user follows Johnny Decimal organization.',
        'Areas use ranges like 10-19, 20-29, etc.',
        'Categories are two-digit numbers within an area (e.g., 11, 12, 23).',
        'Suggest folder names matching this XX or XX.XX numbering pattern.',
      ].join(' ')

    case 'custom':
      if (c.customTopLevel.length === 0) return ''
      return [
        'The user has a custom folder organization.',
        `Allowed top-level folders: ${c.customTopLevel.join(', ')}.`,
        'Only suggest subfolders within these top-level folders.',
      ].join(' ')
  }
}
