import { useState, useCallback, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { toast } from 'sonner'
import { useSnippetStore } from '@/lib/store'
import { useSyncHistoryStore } from '@/lib/sync-history-store'
import {
  exportSnippets,
  quickExportSnippets,
} from '@/lib/raycast/export'
import { validateSnippets, type ValidationResult } from '@/lib/raycast/validation'
import type { Snippet } from '@/types'

export function useExportSync(editorContent: string) {
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [pendingExport, setPendingExport] = useState<Snippet[] | null>(null)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)

  const { snippets, exportSettings, markExported, selectSnippet } = useSnippetStore(
    useShallow((s) => ({
      snippets: s.snippets,
      exportSettings: s.exportSettings,
      markExported: s.markExported,
      selectSnippet: s.selectSnippet,
    }))
  )
  const addSyncEvent = useSyncHistoryStore((s) => s.addEvent)

  const doExport = useCallback(async (toExport: Snippet[], quick = false, autoImportToRaycast = false) => {
    try {
      let path: string
      let autoImportTriggered = false

      if (quick) {
        const result = await quickExportSnippets(toExport, { autoImportToRaycast }, snippets)
        path = result.path
        autoImportTriggered = result.autoImportTriggered ?? false
      } else {
        path = await exportSnippets(toExport, snippets)
      }

      markExported(toExport.map((s) => s.id))

      addSyncEvent('push', 'export', toExport.length, {
        snippetNames: toExport.map((s) => s.name),
        filePath: path,
      })

      if (autoImportTriggered) {
        toast.success(`Exported & importing to Raycast`, {
          description: `${toExport.length} snippet${toExport.length > 1 ? 's' : ''} → ${path}`,
        })
      } else {
        toast.success(`Exported ${toExport.length} snippet${toExport.length > 1 ? 's' : ''} to ${path}`)
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      if (err instanceof Error && err.message === 'No default export path set') {
        toast.error('Set a default export path first')
        return
      }
      toast.error('Export failed')
    }
  }, [markExported, addSyncEvent, snippets])

  const handleExport = useCallback(() => {
    const toExport = snippets.length > 0
      ? snippets
      : [{ id: '1', name: 'Untitled', text: editorContent, tags: [], createdAt: Date.now(), updatedAt: Date.now(), version: 1 }]

    if (toExport.length === 0 || (toExport.length === 1 && !toExport[0].text.trim())) {
      toast.error('Nothing to export')
      return
    }

    const result = validateSnippets(toExport)
    if (result.issues.length > 0) {
      setValidationResult(result)
      setPendingExport(toExport)
      return
    }

    doExport(toExport)
  }, [snippets, editorContent, doExport])

  const handleQuickExport = useCallback((autoImportToRaycast = false) => {
    const toExport = snippets.length > 0
      ? snippets
      : [{ id: '1', name: 'Untitled', text: editorContent, tags: [], createdAt: Date.now(), updatedAt: Date.now(), version: 1 }]

    if (toExport.length === 0 || (toExport.length === 1 && !toExport[0].text.trim())) {
      toast.error('Nothing to export')
      return
    }

    const result = validateSnippets(toExport)
    if (result.issues.length > 0) {
      setValidationResult(result)
      setPendingExport(toExport)
      return
    }

    doExport(toExport, true, autoImportToRaycast)
  }, [snippets, editorContent, doExport])

  const handleSyncToRaycast = useCallback(() => {
    handleQuickExport(true)
  }, [handleQuickExport])

  const handleValidationClose = useCallback(() => {
    setValidationResult(null)
    setPendingExport(null)
  }, [])

  const handleValidationProceed = useCallback(() => {
    if (pendingExport) {
      doExport(pendingExport)
    }
    setValidationResult(null)
    setPendingExport(null)
  }, [pendingExport, doExport])

  const handleNavigateToSnippet = useCallback((snippetId: string) => {
    selectSnippet(snippetId)
  }, [selectSnippet])

  return {
    validationResult,
    exportMenuOpen,
    setExportMenuOpen,
    exportMenuRef,
    exportSettings,
    handleExport,
    handleQuickExport,
    handleSyncToRaycast,
    handleValidationClose,
    handleValidationProceed,
    handleNavigateToSnippet,
  }
}
