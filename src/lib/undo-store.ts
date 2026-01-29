import { create } from 'zustand'
import { useSnippetStore } from './store'

interface MoveAction {
  type: 'move'
  snippetIds: string[]
  previousFolders: { snippetId: string; previousFolderId: string | undefined }[]
  targetFolderId: string | null
}

type UndoAction = MoveAction

interface UndoStore {
  history: UndoAction[]
  maxHistory: number
  pushAction: (action: UndoAction) => void
  undo: () => void
  canUndo: () => boolean
  clear: () => void
}

export const useUndoStore = create<UndoStore>((set, get) => ({
  history: [],
  maxHistory: 50,

  pushAction: (action) => {
    set((state) => ({
      history: [...state.history.slice(-state.maxHistory + 1), action],
    }))
  },

  undo: () => {
    const { history } = get()
    if (history.length === 0) return

    const action = history[history.length - 1]
    set((state) => ({ history: state.history.slice(0, -1) }))

    // Execute undo based on action type
    if (action.type === 'move') {
      const moveSnippetsToFolder = useSnippetStore.getState().moveSnippetsToFolder
      // Restore each snippet to its previous folder
      for (const { snippetId, previousFolderId } of action.previousFolders) {
        moveSnippetsToFolder([snippetId], previousFolderId ?? null)
      }
    }
  },

  canUndo: () => get().history.length > 0,

  clear: () => set({ history: [] }),
}))
