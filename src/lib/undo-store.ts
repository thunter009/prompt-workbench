import { create } from 'zustand'
import { useSnippetStore } from './store'

interface MoveAction {
  type: 'move'
  snippetIds: string[]
  previousFolders: { snippetId: string; previousFolderId: string | undefined }[]
  targetFolderId: string | null
}

interface MoveFolderAction {
  type: 'moveFolder'
  folderId: string
  previousParentId: string | undefined
  previousOrderIndex: number
  newParentId: string | null
  newOrderIndex: number
}

interface ReorderFoldersAction {
  type: 'reorderFolders'
  changes: { folderId: string; previousOrderIndex: number }[]
}

type UndoAction = MoveAction | MoveFolderAction | ReorderFoldersAction

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
    } else if (action.type === 'moveFolder') {
      const moveFolder = useSnippetStore.getState().moveFolder
      moveFolder(action.folderId, action.previousParentId ?? null, action.previousOrderIndex)
    } else if (action.type === 'reorderFolders') {
      const { folders } = useSnippetStore.getState()
      // Restore all folder order indices
      useSnippetStore.setState({
        folders: folders.map((f) => {
          const change = action.changes.find((c) => c.folderId === f.id)
          return change ? { ...f, orderIndex: change.previousOrderIndex } : f
        }),
      })
    }
  },

  canUndo: () => get().history.length > 0,

  clear: () => set({ history: [] }),
}))
