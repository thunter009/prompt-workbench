'use client'

import { useState, useCallback, useMemo } from 'react'
import { History, X, Clock, GitCompare, RotateCcw, Trash2, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useVersionStore } from '@/lib/version-store'
import { useSnippetStore } from '@/lib/store'
import { computeLineDiff } from '@/lib/diff'
import type { SnippetVersion } from '@/types'
import type { DiffComparison } from '@/components/editor/InlineDiffView'

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

// Diff stats badge
function DiffStats({ added, removed }: { added: number; removed: number }) {
  return (
    <span data-testid="diff-stats" className="flex items-center gap-1 text-[10px]">
      {added > 0 && <span className="text-green-600 dark:text-green-400">+{added}</span>}
      {removed > 0 && <span className="text-red-600 dark:text-red-400">-{removed}</span>}
    </span>
  )
}

interface VersionEntryProps {
  version: SnippetVersion
  isCurrent: boolean
  isSelected: boolean
  isCompare: boolean
  showCompare: boolean
  currentText: string
  onClick: (v: SnippetVersion) => void
  onCompare: (v: SnippetVersion, e: React.MouseEvent) => void
  onRestore: (v: SnippetVersion, e: React.MouseEvent) => void
  onDelete: (id: string, e: React.MouseEvent) => void
}

function VersionEntry({ version, isCurrent, isSelected, isCompare, showCompare, currentText, onClick, onCompare, onRestore, onDelete }: VersionEntryProps) {
  const diffStats = useMemo(() => {
    if (version.text === currentText) return null
    return computeLineDiff(version.text, currentText)
  }, [version.text, currentText])

  return (
    <button
      data-testid="version-entry"
      onClick={() => onClick(version)}
      className={cn(
        'w-full text-left p-2 rounded transition-colors group',
        isSelected
          ? 'bg-blue-600/30 text-blue-800 dark:text-blue-200'
          : isCompare
          ? 'bg-purple-600/30 text-purple-200'
          : 'hover:bg-accent/50 text-muted-foreground hover:text-secondary-foreground'
      )}
    >
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-xs font-medium flex items-center gap-1">
          {formatRelativeTime(version.createdAt)}
          {isCurrent && <span className="text-[10px] text-blue-600 dark:text-blue-400">(current)</span>}
          {isCompare && <span className="text-[10px] text-purple-400">(compare)</span>}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            data-testid="version-restore-btn"
            onClick={(e) => onRestore(version, e)}
            className="p-0.5 rounded transition-colors text-muted-foreground hover:text-green-600 dark:hover:text-green-400 opacity-0 group-hover:opacity-100"
            title="Restore this version"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
          {showCompare && !isSelected && (
            <button
              onClick={(e) => onCompare(version, e)}
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
              data-testid="delete-version"
              onClick={(e) => onDelete(version.id, e)}
              className="p-0.5 rounded transition-colors text-muted-foreground hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100"
              title="Delete this version"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground line-clamp-1 flex-1 mr-2">
          {truncatePreview(version.text, 50)}
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          {diffStats && <DiffStats added={diffStats.addedLines} removed={diffStats.removedLines} />}
          <span className="text-[10px] text-muted-foreground">
            {version.text.length}c
          </span>
        </div>
      </div>
    </button>
  )
}

interface VersionHistorySidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDiffChange: (diff: DiffComparison | null) => void
}

export function VersionHistorySidebar({ open, onOpenChange, onDiffChange }: VersionHistorySidebarProps) {
  const selectedId = useSnippetStore((s) => s.selectedId)
  const selectedSnippet = useSnippetStore((s) => s.getSelectedSnippet())
  const updateSnippet = useSnippetStore((s) => s.updateSnippet)
  const getVersionsForSnippet = useVersionStore((s) => s.getVersionsForSnippet)
  const deleteVersion = useVersionStore((s) => s.deleteVersion)
  const keepLastN = useVersionStore((s) => s.keepLastN)

  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
  const [compareVersionId, setCompareVersionId] = useState<string | null>(null)
  const [restoreConfirmVersion, setRestoreConfirmVersion] = useState<SnippetVersion | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [cleanupMenuOpen, setCleanupMenuOpen] = useState(false)

  const versions = useMemo(
    () => (selectedId ? getVersionsForSnippet(selectedId) : []),
    [selectedId, getVersionsForSnippet]
  )

  // Emit diff comparison to parent when selection changes
  const emitDiff = useCallback((version: SnippetVersion | null, compare: SnippetVersion | null) => {
    if (!version) {
      onDiffChange(null)
      return
    }

    const modifiedText = compare?.text ?? selectedSnippet?.text ?? ''
    const modifiedLabel = compare
      ? formatRelativeTime(compare.createdAt)
      : 'Current'

    onDiffChange({
      original: version.text,
      modified: modifiedText,
      originalLabel: formatRelativeTime(version.createdAt),
      modifiedLabel,
      onRestore: () => setRestoreConfirmVersion(version),
      onClose: () => {
        setSelectedVersionId(null)
        setCompareVersionId(null)
        onDiffChange(null)
      },
    })
  }, [selectedSnippet, onDiffChange])

  const handleVersionClick = useCallback((version: SnippetVersion) => {
    setSelectedVersionId(version.id)
    setCompareVersionId(null)
    emitDiff(version, null)
  }, [emitDiff])

  const handleCompareClick = useCallback((version: SnippetVersion, e: React.MouseEvent) => {
    e.stopPropagation()
    setCompareVersionId(version.id)
    // Find the selected version to pass to emitDiff
    const selVersion = versions.find((v) => v.id === selectedVersionId) ?? null
    if (selVersion) {
      emitDiff(selVersion, version)
    }
  }, [versions, selectedVersionId, emitDiff])

  const handleClose = useCallback(() => {
    onOpenChange(false)
    setSelectedVersionId(null)
    setCompareVersionId(null)
    onDiffChange(null)
  }, [onOpenChange, onDiffChange])

  const handleRestoreClick = useCallback((version: SnippetVersion, e: React.MouseEvent) => {
    e.stopPropagation()
    setRestoreConfirmVersion(version)
  }, [])

  const handleRestoreConfirm = useCallback(() => {
    if (!restoreConfirmVersion || !selectedId) return
    updateSnippet(selectedId, { text: restoreConfirmVersion.text })
    toast.success('Version restored')
    setRestoreConfirmVersion(null)
    setSelectedVersionId(null)
    setCompareVersionId(null)
    onDiffChange(null)
  }, [restoreConfirmVersion, selectedId, updateSnippet, onDiffChange])

  const handleRestoreCancel = useCallback(() => {
    setRestoreConfirmVersion(null)
  }, [])

  const handleDeleteVersion = useCallback((versionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeleteConfirmId(versionId)
  }, [])

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteConfirmId) return
    if (selectedVersionId === deleteConfirmId) {
      setSelectedVersionId(null)
      onDiffChange(null)
    }
    if (compareVersionId === deleteConfirmId) {
      setCompareVersionId(null)
    }
    deleteVersion(deleteConfirmId)
    toast.success('Version deleted')
    setDeleteConfirmId(null)
  }, [deleteConfirmId, selectedVersionId, compareVersionId, deleteVersion, onDiffChange])

  const handleDeleteCancel = useCallback(() => {
    setDeleteConfirmId(null)
  }, [])

  const handleKeepLastN = useCallback((n: number) => {
    if (!selectedId) return
    const deletedCount = keepLastN(selectedId, n)
    setCleanupMenuOpen(false)
    setSelectedVersionId(null)
    setCompareVersionId(null)
    onDiffChange(null)
    if (deletedCount > 0) {
      toast.success(`Deleted ${deletedCount} old version${deletedCount !== 1 ? 's' : ''}`)
    } else {
      toast.info('No versions to delete')
    }
  }, [selectedId, keepLastN, onDiffChange])

  if (!open) return null

  return (
    <div data-testid="version-history-sidebar" className="w-64 border-l border-border flex flex-col bg-muted/50 h-full relative animate-in slide-in-from-right-2 duration-150">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-secondary-foreground">Versions</span>
        </div>
        <div className="flex items-center gap-1">
          {versions.length > 1 && (
            <div className="relative">
              <button
                data-testid="clear-versions"
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
        <div data-testid="empty-state" className="flex-1 flex flex-col items-center justify-center p-4 gap-2">
          <Clock className="w-8 h-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground text-center">No versions yet</p>
          <p className="text-xs text-muted-foreground text-center">
            Versions are created automatically when you edit
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="p-2 space-y-1">
            <div className="flex items-center justify-between px-2 py-1">
              <p className="text-xs text-muted-foreground">
                {versions.length} version{versions.length !== 1 ? 's' : ''}
              </p>
              {selectedVersionId && (
                <p className="text-[10px] text-muted-foreground">
                  <GitCompare className="w-3 h-3 inline" /> compare
                </p>
              )}
            </div>
            {versions.map((version, index) => (
              <VersionEntry
                key={version.id}
                version={version}
                isCurrent={index === 0}
                isSelected={selectedVersionId === version.id}
                isCompare={compareVersionId === version.id}
                showCompare={!!selectedVersionId}
                currentText={selectedSnippet?.text ?? ''}
                onClick={handleVersionClick}
                onCompare={handleCompareClick}
                onRestore={handleRestoreClick}
                onDelete={handleDeleteVersion}
              />
            ))}
          </div>
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

      {/* Delete confirmation dialog */}
      {deleteConfirmId && (
        <div data-testid="delete-confirm-dialog" className="absolute inset-0 bg-muted/95 flex flex-col items-center justify-center z-10">
          <div className="p-4 text-center">
            <h3 className="text-sm font-medium text-foreground">Delete this version?</h3>
            <p className="text-xs text-muted-foreground mt-1">This action cannot be undone.</p>
            <div className="flex gap-2 justify-center mt-4">
              <button
                onClick={handleDeleteCancel}
                className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-500 text-white rounded transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
