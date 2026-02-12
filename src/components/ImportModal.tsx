'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { X, Upload, FileJson, Check, AlertCircle, Zap, RefreshCw, Loader2, FolderOpen, ChevronDown, ChevronRight } from 'lucide-react'
import { useSnippetStore } from '@/lib/store'
import { computeLineDiff } from '@/lib/diff'
import type { RaycastSnippet } from '@/types'

interface ImportModalProps {
  open: boolean
  onClose: () => void
}

interface ImportPreview {
  snippets: RaycastSnippet[]
  errors?: string[]
  filename: string
}

interface AvailableFile {
  name: string
  path: string
  age: string
  snippetCount: number
  mtimeMs: number
}

interface ExistingExport {
  found: boolean
  path?: string
  age?: string
  snippetCount?: number
  snippets?: RaycastSnippet[]
  availableFiles?: AvailableFile[]
}

type ConflictResolutionChoice = 'skip' | 'replace' | 'keep-both'

export function ImportModal({ open, onClose }: ImportModalProps) {
  const [dragActive, setDragActive] = useState(false)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [importing, setImporting] = useState(false)
  const [checking, setChecking] = useState(false)
  const [triggering, setTriggering] = useState(false)
  const [existingExport, setExistingExport] = useState<ExistingExport | null>(null)
  const [targetFolderId, setTargetFolderId] = useState<string | null>(null)
  const [folderDropdownOpen, setFolderDropdownOpen] = useState(false)
  const [conflictResolutions, setConflictResolutions] = useState<Map<number, ConflictResolutionChoice>>(new Map())
  const [expandedDiffs, setExpandedDiffs] = useState<Set<number>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  const createSnippet = useSnippetStore((s) => s.createSnippet)
  const updateSnippet = useSnippetStore((s) => s.updateSnippet)
  const snippets = useSnippetStore((s) => s.snippets)
  const folders = useSnippetStore((s) => s.folders)

  // Build set of existing snippet names for conflict detection
  const existingNames = useMemo(() => {
    const names = new Set<string>()
    for (const s of snippets) names.add(s.name.toLowerCase())
    return names
  }, [snippets])

  // Lookup existing snippets by lowercase name for diff
  const existingByName = useMemo(() => {
    const map = new Map<string, typeof snippets[number]>()
    for (const s of snippets) map.set(s.name.toLowerCase(), s)
    return map
  }, [snippets])

  // Detect which preview snippets conflict with existing names
  const conflicts = useMemo(() => {
    if (!preview) return new Set<number>()
    const set = new Set<number>()
    for (let i = 0; i < preview.snippets.length; i++) {
      if (existingNames.has(preview.snippets[i].name.toLowerCase())) {
        set.add(i)
      }
    }
    return set
  }, [preview, existingNames])

  // Count how many snippets will actually be imported
  const importCount = useMemo(() => {
    if (!preview) return 0
    let count = 0
    for (let i = 0; i < preview.snippets.length; i++) {
      if (conflicts.has(i)) {
        const resolution = conflictResolutions.get(i) ?? 'skip'
        if (resolution !== 'skip') count++
      } else if (selected.has(i)) {
        count++
      }
    }
    return count
  }, [preview, conflicts, conflictResolutions, selected])

  // Check for existing export on open
  useEffect(() => {
    if (open) {
      checkForExistingExport()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const checkForExistingExport = useCallback(async () => {
    setChecking(true)
    try {
      const res = await fetch('/api/raycast-import')
      const data = await res.json()
      setExistingExport(data)
    } catch {
      setExistingExport({ found: false })
    } finally {
      setChecking(false)
    }
  }, [])

  const triggerRaycastExport = useCallback(async () => {
    setTriggering(true)
    try {
      const res = await fetch('/api/raycast-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'trigger' }),
      })
      const data = await res.json()

      if (data.success) {
        toast.success('Raycast export dialog opened', {
          description: data.autoSaveAttempted
            ? 'Auto-saving to ~/.prompt-workbench...'
            : 'Save to ~/.prompt-workbench, then click "Check Again"',
        })

        // Poll for the file to appear (auto-save may take a moment)
        let attempts = 0
        const maxAttempts = 10
        const pollInterval = setInterval(async () => {
          attempts++
          const checkRes = await fetch('/api/raycast-import')
          const checkData = await checkRes.json()

          if (checkData.found) {
            clearInterval(pollInterval)
            setExistingExport(checkData)
            toast.success('Export detected!', { description: `${checkData.snippetCount} snippets ready` })
          } else if (attempts >= maxAttempts) {
            clearInterval(pollInterval)
          }
        }, 1000)
      }
    } catch {
      toast.error('Failed to open Raycast')
    } finally {
      setTriggering(false)
    }
  }, [])

  const loadFileFromServer = useCallback(async (filename: string) => {
    try {
      const res = await fetch(`/api/raycast-import?file=${encodeURIComponent(filename)}`)
      const data = await res.json()
      if (!res.ok || !data.snippets) {
        toast.error(data.error || 'Failed to load file')
        return
      }
      setPreview({
        snippets: data.snippets,
        filename,
      })
      setSelected(new Set(data.snippets.map((_: RaycastSnippet, i: number) => i)))
    } catch {
      toast.error('Failed to load file')
    }
  }, [])

  const useExistingExport = useCallback(() => {
    if (!existingExport?.snippets) return

    setPreview({
      snippets: existingExport.snippets,
      filename: existingExport.path?.split('/').pop() || 'raycast-snippets.json',
    })
    setSelected(new Set(existingExport.snippets.map((_, i) => i)))
  }, [existingExport])

  const processFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.json')) {
      toast.error('Please select a JSON file')
      return
    }

    try {
      const text = await file.text()
      const data = JSON.parse(text)

      const snippetsArray = Array.isArray(data) ? data : data.snippets

      if (!Array.isArray(snippetsArray)) {
        toast.error('Invalid file format - expected array of snippets')
        return
      }

      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snippets: snippetsArray }),
      })

      const result = await res.json()

      if (!res.ok) {
        toast.error(result.error || 'Failed to parse file')
        return
      }

      setPreview({
        snippets: result.snippets,
        errors: result.errors,
        filename: file.name,
      })
      setSelected(new Set(result.snippets.map((_: RaycastSnippet, i: number) => i)))
    } catch (err) {
      console.error('Parse error:', err)
      toast.error('Failed to parse JSON file')
    }
  }, [])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }, [processFile])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }, [processFile])

  const toggleSelect = useCallback((index: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    if (!preview) return
    if (selected.size === preview.snippets.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(preview.snippets.map((_, i) => i)))
    }
  }, [preview, selected.size])

  const handleImport = useCallback(async () => {
    if (!preview) return

    setImporting(true)
    try {
      let importedCount = 0

      for (let i = 0; i < preview.snippets.length; i++) {
        const snippet = preview.snippets[i]
        const isConflict = conflicts.has(i)

        if (isConflict) {
          const resolution = conflictResolutions.get(i) ?? 'skip'
          if (resolution === 'skip') continue

          if (resolution === 'replace') {
            const existing = snippets.find(
              (s) => s.name.toLowerCase() === snippet.name.toLowerCase()
            )
            if (existing) {
              updateSnippet(existing.id, {
                text: snippet.text,
                keyword: snippet.keyword,
                folderId: targetFolderId ?? existing.folderId,
              })
              importedCount++
            }
          } else if (resolution === 'keep-both') {
            createSnippet({
              name: `${snippet.name} (imported)`,
              text: snippet.text,
              keyword: snippet.keyword,
              folderId: targetFolderId ?? undefined,
            })
            importedCount++
          }
        } else if (selected.has(i)) {
          createSnippet({
            name: snippet.name,
            text: snippet.text,
            keyword: snippet.keyword,
            folderId: targetFolderId ?? undefined,
          })
          importedCount++
        }
      }

      if (importedCount > 0) {
        toast.success(`Imported ${importedCount} snippet${importedCount > 1 ? 's' : ''}`)
      } else {
        toast.info('No snippets imported')
      }
      onClose()
      setPreview(null)
      setSelected(new Set())
      setConflictResolutions(new Map())
      setExpandedDiffs(new Set())
      setExistingExport(null)
      setTargetFolderId(null)
    } catch (err) {
      console.error('Import error:', err)
      toast.error('Failed to import snippets')
    } finally {
      setImporting(false)
    }
  }, [preview, selected, conflicts, conflictResolutions, snippets, createSnippet, updateSnippet, onClose, targetFolderId])

  const handleClose = useCallback(() => {
    onClose()
    setPreview(null)
    setSelected(new Set())
    setConflictResolutions(new Map())
    setExpandedDiffs(new Set())
    setExistingExport(null)
    setTargetFolderId(null)
  }, [onClose])

  // Focus trap: keep Tab cycling within modal
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose()
      return
    }
    if (e.key !== 'Tab') return
    const modal = modalRef.current
    if (!modal) return
    const focusable = modal.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }, [handleClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-overlay-in" onClick={handleClose} />

      <div ref={modalRef} onKeyDown={handleKeyDown} className="relative bg-muted border border-border rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[85vh] overflow-hidden flex flex-col animate-modal-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-medium">Import from Raycast</h2>
          <button
            onClick={handleClose}
            className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {!preview ? (
            <>
              {/* Quick import button */}
              <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <h3 className="text-sm font-medium text-blue-400 mb-2">Quick Import</h3>
                <p className="text-xs text-blue-300/70 mb-3">
                  Click below to open Raycast&apos;s export dialog automatically
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={triggerRaycastExport}
                    disabled={triggering}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm font-medium transition-colors"
                  >
                    {triggering ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4" />
                    )}
                    Open Raycast Export
                  </button>
                  <button
                    onClick={checkForExistingExport}
                    disabled={checking}
                    className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-foreground/10 disabled:opacity-50 rounded text-sm font-medium transition-colors"
                  >
                    {checking ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    Check Again
                  </button>
                </div>
              </div>

              {/* Files in ~/.prompt-workbench */}
              {existingExport?.availableFiles && existingExport.availableFiles.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <FolderOpen className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium text-foreground">
                      <code className="px-1 bg-accent rounded text-xs">~/.prompt-workbench</code>
                    </h3>
                  </div>
                  <div className="space-y-1.5">
                    {existingExport.availableFiles.map((file, idx) => {
                      const isMostRecent = idx === 0
                      return (
                        <div
                          key={file.name}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
                            isMostRecent
                              ? 'border-green-500/30 bg-green-500/10'
                              : 'border-border bg-accent/30'
                          }`}
                        >
                          <FileJson className={`w-4 h-4 flex-shrink-0 ${isMostRecent ? 'text-green-400' : 'text-muted-foreground'}`} />
                          <div className="flex-1 min-w-0">
                            <span className={`text-sm truncate block ${isMostRecent ? 'text-green-300' : 'text-foreground'}`}>{file.name}</span>
                            <span className={`text-xs ${isMostRecent ? 'text-green-400/60' : 'text-muted-foreground'}`}>{file.snippetCount} snippets · {file.age}</span>
                          </div>
                          <button
                            onClick={() => loadFileFromServer(file.name)}
                            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex-shrink-0 ${
                              isMostRecent
                                ? 'bg-green-600 hover:bg-green-700 text-white'
                                : 'bg-accent hover:bg-accent-foreground/10 text-foreground'
                            }`}
                          >
                            Use This
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Manual instructions */}
              <div className="mb-6 p-4 bg-accent/50 rounded-lg border border-border">
                <h3 className="text-sm font-medium text-foreground mb-2">Or export manually:</h3>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Open Raycast (⌘ Space)</li>
                  <li>Search for &quot;Export Snippets&quot;</li>
                  <li>Save to <code className="px-1 bg-accent rounded">~/.prompt-workbench</code></li>
                  <li>Select the file above or drop it below</li>
                </ol>
              </div>

              {/* Drop zone */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  dragActive
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-border hover:border-border hover:bg-accent/50'
                }`}
              >
                <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground text-sm mb-1">Drop JSON file here</p>
                <p className="text-xs text-muted-foreground">or click to browse</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            </>
          ) : (
            <>
              {/* Preview header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileJson className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm text-secondary-foreground">{preview.filename}</span>
                  <span className="text-xs text-muted-foreground">
                    ({preview.snippets.length} snippet{preview.snippets.length !== 1 ? 's' : ''})
                  </span>
                </div>
                <button
                  onClick={() => { setPreview(null); setSelected(new Set()); setConflictResolutions(new Map()); setExpandedDiffs(new Set()) }}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Choose different file
                </button>
              </div>

              {/* Errors */}
              {preview.errors && preview.errors.length > 0 && (
                <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <div className="flex items-center gap-2 text-amber-400 mb-2">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Some snippets were skipped:</span>
                  </div>
                  <ul className="text-xs text-amber-300/80 space-y-0.5">
                    {preview.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {preview.errors.length > 5 && (
                      <li>...and {preview.errors.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Conflict warning */}
              {conflicts.size > 0 && (
                <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg" data-testid="conflict-warning">
                  <div className="flex items-center gap-2 text-amber-400">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      {conflicts.size} conflict{conflicts.size !== 1 ? 's' : ''} detected
                    </span>
                  </div>
                  <p className="text-xs text-amber-300/70 mt-1">
                    Choose how to handle each duplicate: Skip, Replace, or Keep Both.
                  </p>
                </div>
              )}

              {/* Import to folder selector */}
              <div className="mb-4 relative" data-testid="folder-select">
                <label className="text-xs text-muted-foreground mb-1 block">Import to folder</label>
                <button
                  onClick={() => setFolderDropdownOpen((v) => !v)}
                  className="flex items-center justify-between w-full px-3 py-2 bg-accent border border-border rounded text-sm text-foreground hover:border-border transition-colors"
                >
                  <span>{targetFolderId ? folders.find((f) => f.id === targetFolderId)?.name ?? 'Unknown' : 'No folder (root)'}</span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>
                {folderDropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full bg-accent border border-border rounded shadow-lg max-h-48 overflow-auto">
                    <button
                      onClick={() => { setTargetFolderId(null); setFolderDropdownOpen(false) }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${!targetFolderId ? 'text-blue-400' : 'text-foreground'}`}
                    >
                      No folder (root)
                    </button>
                    {folders.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => { setTargetFolderId(f.id); setFolderDropdownOpen(false) }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${targetFolderId === f.id ? 'text-blue-400' : 'text-foreground'}`}
                      >
                        {f.parentId ? '  └ ' : ''}{f.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Bulk conflict resolution */}
              {conflicts.size > 0 && (
                <div className="mb-3 pb-3 border-b border-border" data-testid="bulk-conflict-resolution">
                  <label className="text-xs text-muted-foreground mb-1.5 block">Apply to all conflicts</label>
                  <div className="flex items-center gap-1">
                    {(['skip', 'replace', 'keep-both'] as const).map((option) => (
                      <button
                        key={option}
                        onClick={() => {
                          setConflictResolutions((prev) => {
                            const next = new Map(prev)
                            for (const idx of conflicts) {
                              next.set(idx, option)
                            }
                            return next
                          })
                        }}
                        className="px-2.5 py-1 text-xs rounded transition-colors bg-accent text-muted-foreground hover:text-foreground"
                        data-testid={`bulk-${option}`}
                      >
                        {option === 'skip' ? 'Skip All' : option === 'replace' ? 'Replace All' : 'Keep All'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Select all */}
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border">
                <button
                  onClick={toggleAll}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                    selected.size === preview.snippets.length
                      ? 'bg-blue-600 border-blue-600'
                      : selected.size > 0
                        ? 'bg-blue-600/50 border-blue-600'
                        : 'border-border'
                  }`}>
                    {selected.size > 0 && <Check className="w-3 h-3" />}
                  </div>
                  Select all ({selected.size}/{preview.snippets.length})
                </button>
              </div>

              {/* Snippet list */}
              <div className="space-y-2 max-h-[40vh] overflow-auto">
                {preview.snippets.map((snippet, i) => {
                  const isConflict = conflicts.has(i)
                  const resolution = conflictResolutions.get(i) ?? 'skip'
                  const isSkipped = isConflict && resolution === 'skip'

                  return (
                    <div
                      key={i}
                      className={`p-3 rounded-lg border transition-colors ${
                        isSkipped
                          ? 'bg-muted/30 border-border opacity-60'
                          : isConflict
                            ? 'bg-yellow-500/10 border-yellow-500/30'
                            : selected.has(i)
                              ? 'bg-accent border-border'
                              : 'bg-accent/30 border-border hover:border-border'
                      }`}
                    >
                      <div className={`flex items-start gap-3 ${!isConflict ? 'cursor-pointer' : ''}`} onClick={() => { if (!isConflict) toggleSelect(i) }}>
                        {!isConflict && (
                          <div className={`w-4 h-4 mt-0.5 rounded border flex-shrink-0 flex items-center justify-center ${
                            selected.has(i) ? 'bg-blue-600 border-blue-600' : 'border-border'
                          }`}>
                            {selected.has(i) && <Check className="w-3 h-3" />}
                          </div>
                        )}
                        {isConflict && (
                          <button
                            className="mt-0.5 flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                            onClick={(e) => {
                              e.stopPropagation()
                              setExpandedDiffs((prev) => {
                                const next = new Set(prev)
                                if (next.has(i)) next.delete(i)
                                else next.add(i)
                                return next
                              })
                            }}
                            data-testid={`conflict-diff-toggle-${i}`}
                          >
                            <ChevronRight className={`w-4 h-4 transition-transform ${expandedDiffs.has(i) ? 'rotate-90' : ''}`} />
                          </button>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium truncate ${isSkipped ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{snippet.name}</span>
                            {isConflict && (
                              <span className="px-1.5 py-0.5 text-xs bg-yellow-500/20 border border-yellow-500/30 rounded text-yellow-400" data-testid="import-conflict-badge">
                                conflict
                              </span>
                            )}
                            {snippet.keyword && (
                              <span className="px-1.5 py-0.5 text-xs bg-accent rounded text-muted-foreground">
                                {snippet.keyword}
                              </span>
                            )}
                            {isConflict && (() => {
                              const existing = existingByName.get(snippet.name.toLowerCase())
                              if (!existing) return null
                              const diff = computeLineDiff(existing.text, snippet.text)
                              if (diff.addedLines === 0 && diff.removedLines === 0) return null
                              return (
                                <span data-testid={`conflict-diff-stats-${i}`} className="flex items-center gap-1 text-[10px]">
                                  {diff.addedLines > 0 && <span className="text-green-400">+{diff.addedLines}</span>}
                                  {diff.removedLines > 0 && <span className="text-red-400">-{diff.removedLines}</span>}
                                </span>
                              )
                            })()}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{snippet.text}</p>
                        </div>
                      </div>
                      {isConflict && (
                        <div className="mt-2 flex items-center gap-1" data-testid={`conflict-resolution-${i}`}>
                          {(['skip', 'replace', 'keep-both'] as const).map((option) => (
                            <button
                              key={option}
                              onClick={(e) => {
                                e.stopPropagation()
                                setConflictResolutions((prev) => {
                                  const next = new Map(prev)
                                  next.set(i, option)
                                  return next
                                })
                              }}
                              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                                resolution === option
                                  ? option === 'skip'
                                    ? 'bg-zinc-600 text-white'
                                    : option === 'replace'
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-green-600 text-white'
                                  : 'bg-accent text-muted-foreground hover:text-foreground'
                              }`}
                              data-testid={`conflict-${option}-${i}`}
                            >
                              {option === 'keep-both' ? 'Keep Both' : option.charAt(0).toUpperCase() + option.slice(1)}
                            </button>
                          ))}
                        </div>
                      )}
                      {isConflict && expandedDiffs.has(i) && (() => {
                        const existing = existingByName.get(snippet.name.toLowerCase())
                        if (!existing) return null
                        const diff = computeLineDiff(existing.text, snippet.text)
                        const nameDiff = existing.name !== snippet.name
                        const keywordDiff = (existing.keyword ?? '') !== (snippet.keyword ?? '')
                        return (
                          <div className="mt-2 border-t border-border pt-2" data-testid={`conflict-diff-panel-${i}`}>
                            {(nameDiff || keywordDiff) && (
                              <div className="mb-2 text-xs space-y-0.5">
                                {nameDiff && (
                                  <div className="flex gap-2">
                                    <span className="text-muted-foreground">Name:</span>
                                    <span className="text-red-400 line-through">{existing.name}</span>
                                    <span className="text-green-400">{snippet.name}</span>
                                  </div>
                                )}
                                {keywordDiff && (
                                  <div className="flex gap-2">
                                    <span className="text-muted-foreground">Keyword:</span>
                                    <span className="text-red-400 line-through">{existing.keyword || '(none)'}</span>
                                    <span className="text-green-400">{snippet.keyword || '(none)'}</span>
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="font-mono text-xs leading-relaxed max-h-48 overflow-auto rounded bg-accent/50 p-2">
                              {diff.changes.map((change, ci) => (
                                <div key={ci}>
                                  {change.value.split('\n').filter((line, li, arr) => !(li === arr.length - 1 && line === '')).map((line, li) => (
                                    <div
                                      key={li}
                                      className={
                                        change.added
                                          ? 'text-green-400 bg-green-500/10'
                                          : change.removed
                                            ? 'text-red-400 bg-red-500/10'
                                            : 'text-muted-foreground'
                                      }
                                    >
                                      <span className="select-none opacity-50 inline-block w-4 text-right mr-2">
                                        {change.added ? '+' : change.removed ? '-' : ' '}
                                      </span>
                                      {line || ' '}
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {preview && (
          <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={importCount === 0 || importing}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm font-medium transition-colors"
            >
              {importing ? 'Importing...' : `Import ${importCount} snippet${importCount !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
