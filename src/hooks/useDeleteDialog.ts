import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { useSnippetStore } from '@/lib/store'
import { useUndoStore } from '@/lib/undo-store'

export function useDeleteDialog() {
  const [deleteDialogIds, setDeleteDialogIds] = useState<string[]>([])
  const deleteDialogRef = useRef<HTMLDialogElement>(null)

  const deleteSnippets = useSnippetStore((s) => s.deleteSnippets)
  const pushUndoAction = useUndoStore((s) => s.pushAction)
  const undo = useUndoStore((s) => s.undo)

  useEffect(() => {
    const dialog = deleteDialogRef.current
    if (!dialog) return
    if (deleteDialogIds.length > 0) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [deleteDialogIds])

  const handleDeleteConfirm = useCallback(() => {
    if (deleteDialogIds.length === 0) return
    const deleted = deleteSnippets(deleteDialogIds)
    if (deleted.length > 0) {
      pushUndoAction({ type: 'snippetDelete', deletedSnippets: deleted })
      toast.success(`Deleted ${deleted.length} snippet${deleted.length > 1 ? 's' : ''}`, {
        duration: 5000,
        action: { label: 'Undo', onClick: () => undo() },
      })
    }
    setDeleteDialogIds([])
  }, [deleteDialogIds, deleteSnippets, pushUndoAction, undo])

  return {
    deleteDialogIds,
    setDeleteDialogIds,
    deleteDialogRef,
    handleDeleteConfirm,
  }
}
