'use client'

import { useEffect, useRef, useCallback } from 'react'
import { AlertCircle, AlertTriangle, X, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ValidationResult, ValidationIssue } from '@/lib/raycast/validation'

interface ValidationDialogProps {
  result: ValidationResult
  open: boolean
  onClose: () => void
  onProceed: () => void
  onNavigateToSnippet: (snippetId: string) => void
}

export function ValidationDialog({
  result,
  open,
  onClose,
  onProceed,
  onNavigateToSnippet,
}: ValidationDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

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

  const handleIssueClick = useCallback(
    (issue: ValidationIssue) => {
      onNavigateToSnippet(issue.snippetId)
      onClose()
    },
    [onNavigateToSnippet, onClose]
  )

  const errors = result.issues.filter((i) => i.severity === 'error')
  const warnings = result.issues.filter((i) => i.severity === 'warning')
  const canProceed = result.valid // no errors

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="backdrop:bg-black/50 bg-transparent p-0 max-w-lg w-full"
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
          <h2 className="text-lg font-medium text-zinc-100">
            {result.valid ? 'Export Warnings' : 'Export Blocked'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {/* Summary */}
          <p className="text-sm text-zinc-400 mb-4">
            {result.errorCount > 0 && (
              <span className="text-red-400">
                {result.errorCount} error{result.errorCount > 1 ? 's' : ''}
              </span>
            )}
            {result.errorCount > 0 && result.warningCount > 0 && ', '}
            {result.warningCount > 0 && (
              <span className="text-yellow-400">
                {result.warningCount} warning{result.warningCount > 1 ? 's' : ''}
              </span>
            )}
          </p>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-red-400 mb-2 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                Errors (must fix)
              </h3>
              <ul className="space-y-2">
                {errors.map((issue, i) => (
                  <li key={`error-${i}`}>
                    <button
                      onClick={() => handleIssueClick(issue)}
                      className="w-full text-left p-2 rounded bg-red-950/30 border border-red-900/50 hover:bg-red-950/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="w-4 h-4 text-red-400 shrink-0" />
                        <span className="text-zinc-200 truncate">{issue.snippetName}</span>
                      </div>
                      <p className="text-xs text-red-300 mt-1 ml-6">{issue.message}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-yellow-400 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Warnings
              </h3>
              <ul className="space-y-2">
                {warnings.map((issue, i) => (
                  <li key={`warning-${i}`}>
                    <button
                      onClick={() => handleIssueClick(issue)}
                      className="w-full text-left p-2 rounded bg-yellow-950/20 border border-yellow-900/30 hover:bg-yellow-950/40 transition-colors"
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="w-4 h-4 text-yellow-400 shrink-0" />
                        <span className="text-zinc-200 truncate">{issue.snippetName}</span>
                      </div>
                      <p className="text-xs text-yellow-300 mt-1 ml-6">{issue.message}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
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
            onClick={onProceed}
            disabled={!canProceed}
            className={cn(
              'px-3 py-1.5 text-sm rounded transition-colors',
              canProceed
                ? 'bg-blue-600 text-white hover:bg-blue-500'
                : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
            )}
          >
            {canProceed ? 'Export Anyway' : 'Fix Errors First'}
          </button>
        </div>
      </div>
    </dialog>
  )
}
