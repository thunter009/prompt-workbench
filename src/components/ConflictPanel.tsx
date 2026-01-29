'use client'

import { useCallback } from 'react'
import { X, AlertTriangle, Check, RefreshCw, Copy } from 'lucide-react'
import { useConflictStore } from '@/lib/conflict-store'
import { useSnippetStore } from '@/lib/store'
import { getConflictLabel } from '@/lib/sync/conflict-detection'
import type { SnippetConflict, ConflictResolution } from '@/types'

interface ConflictItemProps {
  conflict: SnippetConflict
  onResolve: (id: string, resolution: ConflictResolution) => void
}

function ConflictItem({ conflict, onResolve }: ConflictItemProps) {
  const { type, localSnippet, remoteSnippet } = conflict

  return (
    <div className="border border-zinc-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 bg-zinc-800/50 border-b border-zinc-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span className="font-medium text-sm">
            {remoteSnippet?.name || localSnippet?.name || 'Unknown'}
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-300">
            {getConflictLabel(type)}
          </span>
        </div>
      </div>

      {/* Diff view */}
      <div className="grid grid-cols-2 divide-x divide-zinc-700">
        {/* Local */}
        <div className="p-3">
          <div className="text-xs text-zinc-500 mb-2 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Local
          </div>
          {localSnippet ? (
            <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-mono bg-zinc-900/50 p-2 rounded max-h-40 overflow-auto">
              {localSnippet.text || '(empty)'}
            </pre>
          ) : (
            <p className="text-xs text-zinc-500 italic">Not in local</p>
          )}
        </div>

        {/* Remote */}
        <div className="p-3">
          <div className="text-xs text-zinc-500 mb-2 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            Raycast
          </div>
          {remoteSnippet ? (
            <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-mono bg-zinc-900/50 p-2 rounded max-h-40 overflow-auto">
              {remoteSnippet.text || '(empty)'}
            </pre>
          ) : (
            <p className="text-xs text-zinc-500 italic">Deleted in Raycast</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-3 py-2 bg-zinc-800/30 border-t border-zinc-700 flex items-center gap-2">
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
        {localSnippet && remoteSnippet && type === 'modified' && (
          <button
            onClick={() => onResolve(conflict.id, 'keep_both')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-200 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            Keep Both
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

  const updateSnippet = useSnippetStore((s) => s.updateSnippet)
  const createSnippet = useSnippetStore((s) => s.createSnippet)

  const handleResolve = useCallback(
    (conflictId: string, resolution: ConflictResolution) => {
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
      }

      removeConflict(conflictId)
    },
    [conflicts, updateSnippet, createSnippet, removeConflict]
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
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl w-[700px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h2 className="font-medium">
              {conflicts.length} Conflict{conflicts.length > 1 ? 's' : ''} Detected
            </h2>
          </div>
          <button
            onClick={closePanel}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
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
        <div className="px-4 py-3 border-t border-zinc-700 flex items-center justify-between shrink-0">
          <p className="text-xs text-zinc-500">
            Review each conflict and choose which version to keep
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleResolveAll('keep_local')}
              className="px-3 py-1.5 text-sm rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-200 transition-colors"
            >
              Keep All Local
            </button>
            <button
              onClick={() => handleResolveAll('keep_remote')}
              className="px-3 py-1.5 text-sm rounded bg-purple-600 hover:bg-purple-500 text-white transition-colors"
            >
              Use All Raycast
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
