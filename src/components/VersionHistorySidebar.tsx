'use client'

import { useState, useCallback, useMemo } from 'react'
import { History, X, Clock, GitCompare, Eye, RotateCcw } from 'lucide-react'
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
          <span key={i} className="text-zinc-400">
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
    <span className="flex items-center gap-1 text-[10px]">
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

  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
  const [compareVersionId, setCompareVersionId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('preview')
  const [restoreConfirmVersion, setRestoreConfirmVersion] = useState<SnippetVersion | null>(null)

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

  if (!open) return null

  return (
    <div className="w-80 border-l border-zinc-800 flex flex-col bg-zinc-900/50 h-full relative">
      {/* Header */}
      <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-zinc-400" />
          <span className="text-sm font-medium text-zinc-300">Version History</span>
        </div>
        <button
          onClick={handleClose}
          className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      {!selectedId ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-zinc-500 text-center">Select a snippet to view its history</p>
        </div>
      ) : versions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4 gap-2">
          <Clock className="w-8 h-8 text-zinc-600" />
          <p className="text-sm text-zinc-500 text-center">No version history yet</p>
          <p className="text-xs text-zinc-600 text-center">
            Versions are saved automatically as you edit
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Version list */}
          <div className={cn(
            'overflow-y-auto',
            selectedVersion ? 'h-1/2 border-b border-zinc-800' : 'flex-1'
          )}>
            <div className="p-2 space-y-1">
              <div className="flex items-center justify-between px-2 py-1">
                <p className="text-xs text-zinc-500">
                  {versions.length} version{versions.length !== 1 ? 's' : ''}
                </p>
                {selectedVersionId && (
                  <p className="text-xs text-zinc-500">
                    Click <GitCompare className="w-3 h-3 inline" /> to compare
                  </p>
                )}
              </div>
              {versions.map((version) => {
                const isSelected = selectedVersionId === version.id
                const isCompare = compareVersionId === version.id

                return (
                  <button
                    key={version.id}
                    onClick={() => handleVersionClick(version)}
                    className={cn(
                      'w-full text-left p-2 rounded transition-colors group',
                      isSelected
                        ? 'bg-blue-600/30 text-blue-200'
                        : isCompare
                        ? 'bg-purple-600/30 text-purple-200'
                        : 'hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-300'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium flex items-center gap-1">
                        {formatRelativeTime(version.createdAt)}
                        {isCompare && <span className="text-[10px] text-purple-400">(comparing)</span>}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => handleRestoreClick(version, e)}
                          className="p-0.5 rounded transition-colors text-zinc-500 hover:text-green-400 opacity-0 group-hover:opacity-100"
                          title="Restore this version"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                        {selectedVersionId && !isSelected && (
                          <button
                            onClick={(e) => handleCompareClick(version, e)}
                            className={cn(
                              'p-0.5 rounded transition-colors',
                              isCompare
                                ? 'text-purple-400'
                                : 'text-zinc-500 hover:text-zinc-300 opacity-0 group-hover:opacity-100'
                            )}
                            title="Compare with selected"
                          >
                            <GitCompare className="w-3 h-3" />
                          </button>
                        )}
                        <span className="text-[10px] text-zinc-500">
                          {version.text.length} chars
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-zinc-500 line-clamp-2">
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
              <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewMode('preview')}
                    className={cn(
                      'p-1 rounded transition-colors',
                      viewMode === 'preview'
                        ? 'bg-zinc-700 text-zinc-200'
                        : 'text-zinc-500 hover:text-zinc-300'
                    )}
                    title="Preview"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode('diff')}
                    className={cn(
                      'p-1 rounded transition-colors',
                      viewMode === 'diff'
                        ? 'bg-zinc-700 text-zinc-200'
                        : 'text-zinc-500 hover:text-zinc-300'
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
                    className="text-xs text-zinc-500 hover:text-zinc-300"
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Comparison info */}
              {viewMode === 'diff' && (
                <div className="px-3 py-1.5 bg-zinc-800/50 text-[10px] text-zinc-500 flex items-center justify-between">
                  <span>
                    {formatRelativeTime(selectedVersion.createdAt)}
                  </span>
                  <span className="text-zinc-600">→</span>
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
                  <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed">
                    {selectedVersion.text}
                  </pre>
                ) : diffResult ? (
                  <InlineDiff changes={diffResult.changes} />
                ) : (
                  <p className="text-xs text-zinc-500">No changes</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Restore confirmation dialog */}
      {restoreConfirmVersion && (
        <div className="absolute inset-0 bg-zinc-900/95 flex flex-col z-10">
          <div className="p-3 border-b border-zinc-800">
            <h3 className="text-sm font-medium text-zinc-200">Restore version?</h3>
            <p className="text-xs text-zinc-500 mt-1">
              From {formatRelativeTime(restoreConfirmVersion.createdAt)}
            </p>
          </div>
          <div className="flex-1 overflow-auto p-3">
            <pre className="text-xs text-zinc-400 whitespace-pre-wrap font-mono leading-relaxed">
              {restoreConfirmVersion.text}
            </pre>
          </div>
          <div className="p-3 border-t border-zinc-800 flex gap-2 justify-end">
            <button
              onClick={handleRestoreCancel}
              className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 rounded hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
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
