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
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
          <h2 className="text-lg font-medium text-zinc-100">Export Folder</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Folder className="w-5 h-5 text-zinc-400" />
            <span className="text-sm text-zinc-200">{folderName}</span>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeSubfolders}
              onChange={(e) => setIncludeSubfolders(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-zinc-900"
            />
            <span className="text-sm text-zinc-300">Include subfolders</span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-700">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
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
