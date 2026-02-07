'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { X, Folder } from 'lucide-react'

interface ExportFolderDialogProps {
  open: boolean
  folderName: string
  onClose: () => void
  onConfirm: (includeSubfolders: boolean) => void
}

export function ExportFolderDialog({
  open,
  folderName,
  onClose,
  onConfirm,
}: ExportFolderDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [includeSubfolders, setIncludeSubfolders] = useState(true)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [open])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === dialogRef.current) {
        onClose()
      }
    },
    [onClose]
  )

  const handleConfirm = useCallback(() => {
    onConfirm(includeSubfolders)
  }, [onConfirm, includeSubfolders])

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="backdrop:bg-black/50 bg-transparent p-0 max-w-sm w-full"
    >
      <div className="bg-muted border border-border rounded-lg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-lg font-medium text-foreground">Export Folder</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Folder className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm text-foreground">{folderName}</span>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeSubfolders}
              onChange={(e) => setIncludeSubfolders(e.target.checked)}
              className="w-4 h-4 rounded border-border bg-accent text-blue-600 focus:ring-blue-500 focus:ring-offset-background"
            />
            <span className="text-sm text-secondary-foreground">Include subfolders</span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded bg-accent text-secondary-foreground hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-500 transition-colors"
          >
            Export
          </button>
        </div>
      </div>
    </dialog>
  )
}
