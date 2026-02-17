'use client'

import { useCallback, useState } from 'react'
import { X, AlertTriangle, Check, RefreshCw, Copy, GitMerge } from 'lucide-react'
import { useConflictStore } from '@/lib/conflict-store'
import { useSnippetStore } from '@/lib/store'
import { useSyncHistoryStore } from '@/lib/sync-history-store'
import { getConflictLabel } from '@/lib/sync/conflict-detection'
import type { SnippetConflict, ConflictResolution, MergeData } from '@/types'

interface ConflictItemProps {
  conflict: SnippetConflict
  onResolve: (id: string, resolution: ConflictResolution, mergeData?: MergeData) => void
}

function ConflictItem({ conflict, onResolve }: ConflictItemProps) {
  const { type, localSnippet, remoteSnippet } = conflict
  const [mergeMode, setMergeMode] = useState(false)
  const [mergeName, setMergeName] = useState(localSnippet?.name || remoteSnippet?.name || '')
  const [mergeText, setMergeText] = useState(() => {
    // Start with local content, or remote if no local
    return localSnippet?.text || remoteSnippet?.text || ''
  })
  const [mergeKeyword, setMergeKeyword] = useState(
    localSnippet?.keyword || remoteSnippet?.keyword || ''
  )

  const handleMerge = () => {
    onResolve(conflict.id, 'merge', {
      name: mergeName,
      text: mergeText,
      keyword: mergeKeyword || undefined,
    })
  }

  const canMerge = localSnippet && remoteSnippet && type === 'modified'

  if (mergeMode && canMerge) {
    return (
      <div className="border border-border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="px-3 py-2 bg-accent/50 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitMerge className="w-4 h-4 text-green-600 dark:text-green-400" />
            <span className="font-medium text-sm">Merge: {mergeName}</span>
          </div>
          <button
            onClick={() => setMergeMode(false)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>

        {/* Reference views */}
        <div className="grid grid-cols-2 divide-x divide-border bg-muted/30">
          <div className="p-2">
            <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Local (reference)
            </div>
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted/50 p-2 rounded max-h-24 overflow-auto">
              {localSnippet.text || '(empty)'}
            </pre>
          </div>
          <div className="p-2">
            <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              Raycast (reference)
            </div>
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted/50 p-2 rounded max-h-24 overflow-auto">
              {remoteSnippet.text || '(empty)'}
            </pre>
          </div>
        </div>

        {/* Merge editor */}
        <div className="p-3 border-t border-border">
          <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Merged result
          </div>
          <div className="space-y-2">
            <input
              type="text"
              value={mergeName}
              onChange={(e) => setMergeName(e.target.value)}
              placeholder="Name"
              className="w-full px-2 py-1 text-xs bg-accent border border-border rounded text-foreground focus:outline-none focus:border-green-500"
            />
            <textarea
              value={mergeText}
              onChange={(e) => setMergeText(e.target.value)}
              placeholder="Snippet text..."
              rows={5}
              className="w-full px-2 py-1.5 text-xs font-mono bg-accent border border-border rounded text-foreground focus:outline-none focus:border-green-500 resize-none"
            />
            <input
              type="text"
              value={mergeKeyword}
              onChange={(e) => setMergeKeyword(e.target.value)}
              placeholder="Keyword (optional)"
              className="w-full px-2 py-1 text-xs bg-accent border border-border rounded text-foreground focus:outline-none focus:border-green-500"
            />
          </div>
        </div>

        {/* Merge actions */}
        <div className="px-3 py-2 bg-accent/30 border-t border-border flex items-center gap-2">
          <button
            onClick={handleMerge}
            disabled={!mergeName.trim() || !mergeText.trim()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded bg-green-600 hover:bg-green-500 disabled:bg-accent disabled:text-muted-foreground text-white transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            Apply Merge
          </button>
          <button
            onClick={() => setMergeMode(false)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded bg-accent hover:bg-accent-foreground/10 text-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 bg-accent/50 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span className="font-medium text-sm">
            {remoteSnippet?.name || localSnippet?.name || 'Unknown'}
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-600 dark:text-amber-300">
            {getConflictLabel(type)}
          </span>
        </div>
      </div>

      {/* Diff view */}
      <div className="grid grid-cols-2 divide-x divide-border">
        {/* Local */}
        <div className="p-3">
          <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Local
          </div>
          {localSnippet ? (
            <pre className="text-xs text-secondary-foreground whitespace-pre-wrap font-mono bg-muted/50 p-2 rounded max-h-40 overflow-auto">
              {localSnippet.text || '(empty)'}
            </pre>
          ) : (
            <p className="text-xs text-muted-foreground italic">Not in local</p>
          )}
        </div>

        {/* Remote */}
        <div className="p-3">
          <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            Raycast
          </div>
          {remoteSnippet ? (
            <pre className="text-xs text-secondary-foreground whitespace-pre-wrap font-mono bg-muted/50 p-2 rounded max-h-40 overflow-auto">
              {remoteSnippet.text || '(empty)'}
            </pre>
          ) : (
            <p className="text-xs text-muted-foreground italic">Deleted in Raycast</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-3 py-2 bg-accent/30 border-t border-border flex items-center gap-2">
        {localSnippet && (
          <button
            onClick={() => onResolve(conflict.id, 'keep_local')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            Keep Local
          </button>
        )}
        {remoteSnippet && (
          <button
            onClick={() => onResolve(conflict.id, 'keep_remote')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded bg-purple-600 hover:bg-purple-500 text-white transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Use Raycast
          </button>
        )}
        {canMerge && (
          <button
            onClick={() => setMergeMode(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded bg-green-600 hover:bg-green-500 text-white transition-colors"
          >
            <GitMerge className="w-3.5 h-3.5" />
            Merge
          </button>
        )}
      </div>
    </div>
  )
}

export function ConflictPanel() {
  const conflicts = useConflictStore((s) => s.conflicts)
  const panelOpen = useConflictStore((s) => s.panelOpen)
  const closePanel = useConflictStore((s) => s.closePanel)
  const removeConflict = useConflictStore((s) => s.removeConflict)
  const [applyToAllOpen, setApplyToAllOpen] = useState(false)

  const updateSnippet = useSnippetStore((s) => s.updateSnippet)
  const createSnippet = useSnippetStore((s) => s.createSnippet)
  const addSyncEvent = useSyncHistoryStore((s) => s.addEvent)

  // Count applicable conflicts for each resolution type
  const conflictsWithLocal = conflicts.filter((c) => c.localSnippet)
  const conflictsWithRemote = conflicts.filter((c) => c.remoteSnippet)
  const modifiedConflicts = conflicts.filter(
    (c) => c.type === 'modified' && c.localSnippet && c.remoteSnippet
  )

  const handleResolve = useCallback(
    (conflictId: string, resolution: ConflictResolution, mergeData?: MergeData) => {
      const conflict = conflicts.find((c) => c.id === conflictId)
      if (!conflict) return

      const { localSnippet, remoteSnippet } = conflict

      switch (resolution) {
        case 'keep_local':
          // Just remove conflict, local is already correct
          break

        case 'keep_remote':
          if (remoteSnippet) {
            if (localSnippet) {
              // Update existing snippet with remote content
              updateSnippet(localSnippet.id, {
                name: remoteSnippet.name,
                text: remoteSnippet.text,
                keyword: remoteSnippet.keyword,
                raycastSyncedAt: Date.now(),
              })
            } else {
              // Create new snippet from remote
              createSnippet({
                name: remoteSnippet.name,
                text: remoteSnippet.text,
                keyword: remoteSnippet.keyword,
                raycastSyncedAt: Date.now(),
              })
            }
          }
          break

        case 'keep_both':
          if (remoteSnippet && localSnippet) {
            // Create new snippet with remote content, suffix name
            createSnippet({
              name: `${remoteSnippet.name} (from Raycast)`,
              text: remoteSnippet.text,
              keyword: remoteSnippet.keyword
                ? `${remoteSnippet.keyword}-raycast`
                : undefined,
              raycastSyncedAt: Date.now(),
            })
          }
          break

        case 'merge':
          if (mergeData && localSnippet) {
            // Update local snippet with merged content
            updateSnippet(localSnippet.id, {
              name: mergeData.name,
              text: mergeData.text,
              keyword: mergeData.keyword,
              raycastSyncedAt: Date.now(),
            })
          }
          break
      }

      // Log conflict resolution to history
      const snippetName = localSnippet?.name || remoteSnippet?.name || 'Unknown'
      addSyncEvent('conflict', 'conflict_resolved', 1, {
        snippetNames: [snippetName],
        resolution,
      })

      removeConflict(conflictId)
    },
    [conflicts, updateSnippet, createSnippet, removeConflict, addSyncEvent]
  )

  const handleResolveAll = useCallback(
    (resolution: ConflictResolution) => {
      for (const conflict of conflicts) {
        handleResolve(conflict.id, resolution)
      }
    },
    [conflicts, handleResolve]
  )

  if (!panelOpen || conflicts.length === 0) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-muted border border-border rounded-lg shadow-xl w-[700px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <h2 className="font-medium">
              {conflicts.length} Conflict{conflicts.length > 1 ? 's' : ''} Detected
            </h2>
          </div>
          <button
            onClick={closePanel}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {conflicts.map((conflict) => (
            <ConflictItem
              key={conflict.id}
              conflict={conflict}
              onResolve={handleResolve}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border flex items-center justify-between shrink-0">
          <p className="text-xs text-muted-foreground">
            {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} remaining
          </p>
          <div className="flex items-center gap-2 relative">
            <button
              onClick={() => setApplyToAllOpen(!applyToAllOpen)}
              className="px-3 py-1.5 text-sm rounded bg-accent hover:bg-accent-foreground/10 text-foreground transition-colors flex items-center gap-1.5"
            >
              Apply to All
              <svg
                className={`w-3 h-3 transition-transform ${applyToAllOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {applyToAllOpen && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setApplyToAllOpen(false)}
                />
                {/* Dropdown menu */}
                <div className="absolute bottom-full right-0 mb-1 bg-accent border border-border rounded-lg shadow-lg overflow-hidden z-50 min-w-48">
                  {conflictsWithLocal.length > 0 && (
                    <button
                      onClick={() => {
                        handleResolveAll('keep_local')
                        setApplyToAllOpen(false)
                      }}
                      className="w-full px-3 py-2 text-sm text-left text-foreground hover:bg-accent flex items-center gap-2"
                    >
                      <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Keep All Local</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {conflictsWithLocal.length}
                      </span>
                    </button>
                  )}
                  {conflictsWithRemote.length > 0 && (
                    <button
                      onClick={() => {
                        handleResolveAll('keep_remote')
                        setApplyToAllOpen(false)
                      }}
                      className="w-full px-3 py-2 text-sm text-left text-foreground hover:bg-accent flex items-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4 text-purple-400" />
                      <span>Use All Raycast</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {conflictsWithRemote.length}
                      </span>
                    </button>
                  )}
                  {modifiedConflicts.length > 0 && (
                    <button
                      onClick={() => {
                        handleResolveAll('keep_both')
                        setApplyToAllOpen(false)
                      }}
                      className="w-full px-3 py-2 text-sm text-left text-foreground hover:bg-accent flex items-center gap-2 border-t border-border"
                    >
                      <Copy className="w-4 h-4 text-muted-foreground" />
                      <span>Keep All Both</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {modifiedConflicts.length}
                      </span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
