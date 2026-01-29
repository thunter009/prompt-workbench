'use client'

import { useState, useCallback } from 'react'
import { History, X, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useVersionStore } from '@/lib/version-store'
import { useSnippetStore } from '@/lib/store'
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

interface VersionHistorySidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function VersionHistorySidebar({ open, onOpenChange }: VersionHistorySidebarProps) {
  const selectedId = useSnippetStore((s) => s.selectedId)
  const selectedSnippet = useSnippetStore((s) => s.getSelectedSnippet())
  const getVersionsForSnippet = useVersionStore((s) => s.getVersionsForSnippet)

  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
  const [previewVersion, setPreviewVersion] = useState<SnippetVersion | null>(null)

  const versions = selectedId ? getVersionsForSnippet(selectedId) : []

  const handleVersionClick = useCallback((version: SnippetVersion) => {
    setSelectedVersionId(version.id)
    setPreviewVersion(version)
  }, [])

  const handleClose = useCallback(() => {
    onOpenChange(false)
    setSelectedVersionId(null)
    setPreviewVersion(null)
  }, [onOpenChange])

  if (!open) return null

  return (
    <div className="w-80 border-l border-zinc-800 flex flex-col bg-zinc-900/50 h-full">
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
            previewVersion ? 'h-1/2 border-b border-zinc-800' : 'flex-1'
          )}>
            <div className="p-2 space-y-1">
              <p className="text-xs text-zinc-500 px-2 py-1">
                {versions.length} version{versions.length !== 1 ? 's' : ''} for &quot;{selectedSnippet?.name}&quot;
              </p>
              {versions.map((version) => (
                <button
                  key={version.id}
                  onClick={() => handleVersionClick(version)}
                  className={cn(
                    'w-full text-left p-2 rounded transition-colors',
                    selectedVersionId === version.id
                      ? 'bg-blue-600/30 text-blue-200'
                      : 'hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-300'
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">
                      {formatRelativeTime(version.createdAt)}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      {version.text.length} chars
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 line-clamp-2">
                    {truncatePreview(version.text)}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Preview panel */}
          {previewVersion && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
                <span className="text-xs text-zinc-400">
                  {formatRelativeTime(previewVersion.createdAt)}
                </span>
                <button
                  onClick={() => {
                    setPreviewVersion(null)
                    setSelectedVersionId(null)
                  }}
                  className="text-xs text-zinc-500 hover:text-zinc-300"
                >
                  Close preview
                </button>
              </div>
              <div className="flex-1 overflow-auto p-3">
                <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed">
                  {previewVersion.text}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
