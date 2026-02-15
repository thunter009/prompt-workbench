import { create } from 'zustand'
import { dbClient } from './db/client'

export type MethodologyPreset = 'flat' | 'para' | 'johnny-decimal' | 'custom'

export interface MethodologyConfig {
  preset: MethodologyPreset
  customTopLevel: string[]
}

interface MethodologyStore {
  config: MethodologyConfig
  setPreset: (preset: MethodologyPreset) => void
  setCustomTopLevel: (folders: string[]) => void
  addCustomFolder: (name: string) => void
  removeCustomFolder: (name: string) => void
  hydrate: () => Promise<void>
}

export const useMethodologyStore = create<MethodologyStore>((set) => ({
  config: {
    preset: 'flat',
    customTopLevel: [],
  },

  setPreset: (preset) => {
    set((state) => {
      const config = { ...state.config, preset }
      dbClient.saveSetting('folderMethodology', config)
      return { config }
    })
  },

  setCustomTopLevel: (folders) => {
    set((state) => {
      const config = { ...state.config, customTopLevel: folders }
      dbClient.saveSetting('folderMethodology', config)
      return { config }
    })
  },

  addCustomFolder: (name) => {
    set((state) => {
      if (state.config.customTopLevel.includes(name)) return state
      const config = {
        ...state.config,
        customTopLevel: [...state.config.customTopLevel, name],
      }
      dbClient.saveSetting('folderMethodology', config)
      return { config }
    })
  },

  removeCustomFolder: (name) => {
    set((state) => {
      const config = {
        ...state.config,
        customTopLevel: state.config.customTopLevel.filter((f) => f !== name),
      }
      dbClient.saveSetting('folderMethodology', config)
      return { config }
    })
  },

  hydrate: async () => {
    try {
      const settings = await dbClient.getSettings(['folderMethodology'])
      const stored = settings.folderMethodology as MethodologyConfig | undefined
      if (stored) {
        set({ config: stored })
      }
    } catch {
      // DB not available
    }
  },
}))

export const PARA_FOLDERS = ['Projects', 'Areas', 'Resources', 'Archive'] as const

const JD_AREA_PATTERN = /^\d0-\d9$/
const JD_CATEGORY_PATTERN = /^\d{2}$/
const JD_ID_PATTERN = /^\d{2}\.\d{2}$/

export interface FolderValidationResult {
  valid: boolean
  warning?: string
}

export function validateFolderName(
  name: string,
  config?: MethodologyConfig
): FolderValidationResult {
  const c = config ?? useMethodologyStore.getState().config

  switch (c.preset) {
    case 'flat':
      return { valid: true }

    case 'para': {
      const isParaFolder = PARA_FOLDERS.some(
        (p) => p.toLowerCase() === name.toLowerCase()
      )
      if (!isParaFolder) {
        return {
          valid: false,
          warning: `Not a PARA folder. Expected: ${PARA_FOLDERS.join(', ')}`,
        }
      }
      return { valid: true }
    }

    case 'johnny-decimal': {
      if (
        JD_AREA_PATTERN.test(name) ||
        JD_CATEGORY_PATTERN.test(name) ||
        JD_ID_PATTERN.test(name)
      ) {
        return { valid: true }
      }
      return {
        valid: false,
        warning: 'Not a Johnny Decimal name. Expected: X0-X9, XX, or XX.XX',
      }
    }

    case 'custom': {
      if (c.customTopLevel.length === 0) return { valid: true }
      const allowed = c.customTopLevel.some(
        (f) => f.toLowerCase() === name.toLowerCase()
      )
      if (!allowed) {
        return {
          valid: false,
          warning: `Not in allowed folders: ${c.customTopLevel.join(', ')}`,
        }
      }
      return { valid: true }
    }
  }
}

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
