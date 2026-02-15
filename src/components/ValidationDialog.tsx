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
      data-testid="validation-dialog"
      className="backdrop:bg-black/50 bg-transparent p-0 max-w-lg w-full"
    >
      <div className="bg-muted border border-border rounded-lg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-lg font-medium text-foreground">
            {result.valid ? 'Export Warnings' : 'Export Blocked'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {/* Summary */}
          <p className="text-sm text-muted-foreground mb-4">
            {result.errorCount > 0 && (
              <span className="text-red-700 dark:text-red-400">
                {result.errorCount} error{result.errorCount > 1 ? 's' : ''}
              </span>
            )}
            {result.errorCount > 0 && result.warningCount > 0 && ', '}
            {result.warningCount > 0 && (
              <span className="text-amber-600 dark:text-yellow-400">
                {result.warningCount} warning{result.warningCount > 1 ? 's' : ''}
              </span>
            )}
          </p>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-red-700 dark:text-red-400 mb-2 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                Errors (must fix)
              </h3>
              <ul className="space-y-2">
                {errors.map((issue, i) => (
                  <li key={`error-${i}`}>
                    <button
                      onClick={() => handleIssueClick(issue)}
                      className="w-full text-left p-2 rounded bg-red-100 dark:bg-red-950/30 border border-red-300 dark:border-red-900/50 hover:bg-red-200 dark:hover:bg-red-950/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="w-4 h-4 text-red-700 dark:text-red-400 shrink-0" />
                        <span className="text-foreground truncate">{issue.snippetName}</span>
                      </div>
                      <p className="text-xs text-red-600 dark:text-red-300 mt-1 ml-6">{issue.message}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-amber-600 dark:text-yellow-400 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Warnings
              </h3>
              <ul className="space-y-2">
                {warnings.map((issue, i) => (
                  <li key={`warning-${i}`}>
                    <button
                      onClick={() => handleIssueClick(issue)}
                      className="w-full text-left p-2 rounded bg-amber-100 dark:bg-yellow-950/20 border border-amber-300 dark:border-yellow-900/30 hover:bg-amber-200 dark:hover:bg-yellow-950/40 transition-colors"
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="w-4 h-4 text-amber-600 dark:text-yellow-400 shrink-0" />
                        <span className="text-foreground truncate">{issue.snippetName}</span>
                      </div>
                      <p className="text-xs text-amber-600 dark:text-yellow-300 mt-1 ml-6">{issue.message}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
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
            onClick={onProceed}
            disabled={!canProceed}
            className={cn(
              'px-3 py-1.5 text-sm rounded transition-colors',
              canProceed
                ? 'bg-blue-600 text-white hover:bg-blue-500'
                : 'bg-accent text-muted-foreground cursor-not-allowed'
            )}
          >
            {canProceed ? 'Export Anyway' : 'Fix Errors First'}
          </button>
        </div>
      </div>
    </dialog>
  )
}
