'use client'

import { useState, useCallback, useMemo } from 'react'
import { History, X, Clock, GitCompare, Eye, RotateCcw, Trash2, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useVersionStore } from '@/lib/version-store'
import { useSnippetStore } from '@/lib/store'
import { computeLineDiff, type DiffChange } from '@/lib/diff'
import type { SnippetVersion } from '@/types'

function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`

  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function truncatePreview(text: string, maxLength: number = 80): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + '...'
}

// Inline diff view component
function InlineDiff({ changes }: { changes: DiffChange[] }) {
  return (
    <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap">
      {changes.map((change, i) => {
        if (change.added) {
          return (
            <span key={i} className="bg-green-900/50 text-green-300">
              {change.value}
            </span>
          )
        }
        if (change.removed) {
          return (
            <span key={i} className="bg-red-900/50 text-red-300 line-through">
              {change.value}
            </span>
          )
        }
        return (
          <span key={i} className="text-muted-foreground">
            {change.value}
          </span>
        )
      })}
    </pre>
  )
}

// Diff stats badge
function DiffStats({ added, removed }: { added: number; removed: number }) {
  return (
    <span data-testid="diff-stats" className="flex items-center gap-1 text-[10px]">
      {added > 0 && <span className="text-green-400">+{added}</span>}
      {removed > 0 && <span className="text-red-400">-{removed}</span>}
    </span>
  )
}

type ViewMode = 'preview' | 'diff'

interface VersionHistorySidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function VersionHistorySidebar({ open, onOpenChange }: VersionHistorySidebarProps) {
  const selectedId = useSnippetStore((s) => s.selectedId)
  const selectedSnippet = useSnippetStore((s) => s.getSelectedSnippet())
  const updateSnippet = useSnippetStore((s) => s.updateSnippet)
  const getVersionsForSnippet = useVersionStore((s) => s.getVersionsForSnippet)
  const deleteVersion = useVersionStore((s) => s.deleteVersion)
  const keepLastN = useVersionStore((s) => s.keepLastN)

  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
  const [compareVersionId, setCompareVersionId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('preview')
  const [restoreConfirmVersion, setRestoreConfirmVersion] = useState<SnippetVersion | null>(null)
  const [cleanupMenuOpen, setCleanupMenuOpen] = useState(false)

  const versions = useMemo(
    () => (selectedId ? getVersionsForSnippet(selectedId) : []),
    [selectedId, getVersionsForSnippet]
  )

  const selectedVersion = useMemo(
    () => versions.find((v) => v.id === selectedVersionId) ?? null,
    [versions, selectedVersionId]
  )

  const compareVersion = useMemo(
    () => versions.find((v) => v.id === compareVersionId) ?? null,
    [versions, compareVersionId]
  )

  // Compute diff when in diff mode
  const diffResult = useMemo(() => {
    if (viewMode !== 'diff' || !selectedVersion) return null

    // Compare selected version vs compare version (or current content)
    return computeLineDiff(selectedVersion.text, compareVersion?.text ?? selectedSnippet?.text ?? '')
  }, [viewMode, selectedVersion, compareVersion, selectedSnippet])

  const handleVersionClick = useCallback((version: SnippetVersion) => {
    setSelectedVersionId(version.id)
    setCompareVersionId(null)
  }, [])

  const handleCompareClick = useCallback((version: SnippetVersion, e: React.MouseEvent) => {
    e.stopPropagation()
    setCompareVersionId(version.id)
    setViewMode('diff')
  }, [])

  const handleClose = useCallback(() => {
    onOpenChange(false)
    setSelectedVersionId(null)
    setCompareVersionId(null)
    setViewMode('preview')
  }, [onOpenChange])

  const clearComparison = useCallback(() => {
    setCompareVersionId(null)
    setViewMode('preview')
  }, [])

  const handleRestoreClick = useCallback((version: SnippetVersion, e: React.MouseEvent) => {
    e.stopPropagation()
    setRestoreConfirmVersion(version)
  }, [])

  const handleRestoreConfirm = useCallback(() => {
    if (!restoreConfirmVersion || !selectedId) return
    // Update snippet text - this will auto-save a new version via the debounced save
    updateSnippet(selectedId, { text: restoreConfirmVersion.text })
    toast.success('Version restored')
    setRestoreConfirmVersion(null)
    setSelectedVersionId(null)
  }, [restoreConfirmVersion, selectedId, updateSnippet])

  const handleRestoreCancel = useCallback(() => {
    setRestoreConfirmVersion(null)
  }, [])

  const handleDeleteVersion = useCallback((versionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    // Clear selection if we're deleting the selected version
    if (selectedVersionId === versionId) {
      setSelectedVersionId(null)
      setViewMode('preview')
    }
    if (compareVersionId === versionId) {
      setCompareVersionId(null)
    }
    deleteVersion(versionId)
    toast.success('Version deleted')
  }, [selectedVersionId, compareVersionId, deleteVersion])

  const handleKeepLastN = useCallback((n: number) => {
    if (!selectedId) return
    const deletedCount = keepLastN(selectedId, n)
    setCleanupMenuOpen(false)
    // Clear selections that may have been deleted
    setSelectedVersionId(null)
    setCompareVersionId(null)
    setViewMode('preview')
    if (deletedCount > 0) {
      toast.success(`Deleted ${deletedCount} old version${deletedCount !== 1 ? 's' : ''}`)
    } else {
      toast.info('No versions to delete')
    }
  }, [selectedId, keepLastN])

  if (!open) return null

  return (
    <div data-testid="version-history-sidebar" className="w-80 border-l border-border flex flex-col bg-muted/50 h-full relative animate-in slide-in-from-right-2 duration-150">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-secondary-foreground">Version History</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Cleanup dropdown */}
          {versions.length > 1 && (
            <div className="relative">
              <button
                onClick={() => setCleanupMenuOpen(!cleanupMenuOpen)}
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                title="Cleanup versions"
              >
                <Trash2 className="w-4 h-4" />
                <ChevronDown className="w-3 h-3" />
              </button>
              {cleanupMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setCleanupMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 z-20 bg-accent border border-border rounded-md shadow-lg py-1 min-w-[140px]">
                    <p className="px-3 py-1 text-[10px] text-muted-foreground uppercase tracking-wide">
                      Keep only last...
                    </p>
                    {[5, 10, 20, 50].map((n) => (
                      <button
                        key={n}
                        onClick={() => handleKeepLastN(n)}
                        disabled={versions.length <= n}
                        className={cn(
                          'w-full text-left px-3 py-1.5 text-xs transition-colors',
                          versions.length <= n
                            ? 'text-muted-foreground cursor-not-allowed'
                            : 'text-secondary-foreground hover:bg-accent'
                        )}
                      >
                        {n} versions
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          <button
            onClick={handleClose}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {!selectedId ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-muted-foreground text-center">Select a snippet to view its history</p>
        </div>
      ) : versions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4 gap-2">
          <Clock className="w-8 h-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground text-center">No versions yet</p>
          <p className="text-xs text-muted-foreground text-center">
            Versions are created automatically when you edit
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Version list */}
          <div className={cn(
            'overflow-y-auto',
            selectedVersion ? 'h-1/2 border-b border-border' : 'flex-1'
          )}>
            <div className="p-2 space-y-1">
              <div className="flex items-center justify-between px-2 py-1">
                <p className="text-xs text-muted-foreground">
                  {versions.length} version{versions.length !== 1 ? 's' : ''}
                </p>
                {selectedVersionId && (
                  <p className="text-xs text-muted-foreground">
                    Click <GitCompare className="w-3 h-3 inline" /> to compare
                  </p>
                )}
              </div>
              {versions.map((version, index) => {
                const isSelected = selectedVersionId === version.id
                const isCompare = compareVersionId === version.id
                const isCurrent = index === 0

                return (
                  <button
                    key={version.id}
                    data-testid="version-entry"
                    onClick={() => handleVersionClick(version)}
                    className={cn(
                      'w-full text-left p-2 rounded transition-colors group',
                      isSelected
                        ? 'bg-blue-600/30 text-blue-200'
                        : isCompare
                        ? 'bg-purple-600/30 text-purple-200'
                        : 'hover:bg-accent/50 text-muted-foreground hover:text-secondary-foreground'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium flex items-center gap-1">
                        {formatRelativeTime(version.createdAt)}
                        {isCurrent && <span className="text-[10px] text-blue-400">(current)</span>}
                        {isCompare && <span className="text-[10px] text-purple-400">(comparing)</span>}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          data-testid="version-restore-btn"
                          onClick={(e) => handleRestoreClick(version, e)}
                          className="p-0.5 rounded transition-colors text-muted-foreground hover:text-green-400 opacity-0 group-hover:opacity-100"
                          title="Restore this version"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                        {selectedVersionId && !isSelected && (
                          <button
                            onClick={(e) => handleCompareClick(version, e)}
                            data-testid="version-compare-btn"
                            className={cn(
                              'p-0.5 rounded transition-colors',
                              isCompare
                                ? 'text-purple-400'
                                : 'text-muted-foreground hover:text-secondary-foreground opacity-0 group-hover:opacity-100'
                            )}
                            title="Compare with selected"
                          >
                            <GitCompare className="w-3 h-3" />
                          </button>
                        )}
                        {!isCurrent && (
                          <button
                            onClick={(e) => handleDeleteVersion(version.id, e)}
                            className="p-0.5 rounded transition-colors text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100"
                            title="Delete this version"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {version.text.length} chars
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {truncatePreview(version.text)}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Preview/Diff panel */}
          {selectedVersion && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Panel header with view mode toggle */}
              <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    data-testid="view-mode-preview"
                    onClick={() => setViewMode('preview')}
                    className={cn(
                      'p-1 rounded transition-colors',
                      viewMode === 'preview'
                        ? 'bg-accent text-foreground'
                        : 'text-muted-foreground hover:text-secondary-foreground'
                    )}
                    title="Preview"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    data-testid="view-mode-diff"
                    onClick={() => setViewMode('diff')}
                    className={cn(
                      'p-1 rounded transition-colors',
                      viewMode === 'diff'
                        ? 'bg-accent text-foreground'
                        : 'text-muted-foreground hover:text-secondary-foreground'
                    )}
                    title="Diff view"
                  >
                    <GitCompare className="w-3.5 h-3.5" />
                  </button>
                  {viewMode === 'diff' && diffResult && (
                    <DiffStats added={diffResult.addedLines} removed={diffResult.removedLines} />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {compareVersionId && (
                    <button
                      onClick={clearComparison}
                      className="text-[10px] text-purple-400 hover:text-purple-300"
                    >
                      Clear compare
                    </button>
                  )}
                  <button
                    onClick={(e) => handleRestoreClick(selectedVersion, e)}
                    className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Restore
                  </button>
                  <button
                    onClick={() => {
                      setSelectedVersionId(null)
                      setCompareVersionId(null)
                      setViewMode('preview')
                    }}
                    className="text-xs text-muted-foreground hover:text-secondary-foreground"
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Comparison info */}
              {viewMode === 'diff' && (
                <div className="px-3 py-1.5 bg-accent/50 text-[10px] text-muted-foreground flex items-center justify-between">
                  <span>
                    {formatRelativeTime(selectedVersion.createdAt)}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <span>
                    {compareVersion
                      ? formatRelativeTime(compareVersion.createdAt)
                      : 'Current'}
                  </span>
                </div>
              )}

              {/* Content */}
              <div className="flex-1 overflow-auto p-3">
                {viewMode === 'preview' ? (
                  <pre className="text-xs text-secondary-foreground whitespace-pre-wrap font-mono leading-relaxed">
                    {selectedVersion.text}
                  </pre>
                ) : diffResult ? (
                  <InlineDiff changes={diffResult.changes} />
                ) : (
                  <p className="text-xs text-muted-foreground">No changes</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Restore confirmation dialog */}
      {restoreConfirmVersion && (
        <div data-testid="restore-confirm-dialog" className="absolute inset-0 bg-muted/95 flex flex-col z-10">
          <div className="p-3 border-b border-border">
            <h3 className="text-sm font-medium text-foreground">Restore version?</h3>
            <p className="text-xs text-muted-foreground mt-1">
              From {formatRelativeTime(restoreConfirmVersion.createdAt)}
            </p>
          </div>
          <div className="flex-1 overflow-auto p-3">
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
              {restoreConfirmVersion.text}
            </pre>
          </div>
          <div className="p-3 border-t border-border flex gap-2 justify-end">
            <button
              data-testid="restore-cancel-btn"
              onClick={handleRestoreCancel}
              className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              data-testid="restore-confirm-btn"
              onClick={handleRestoreConfirm}
              className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-500 text-white rounded transition-colors flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Restore
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
