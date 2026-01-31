'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { X, Loader2, Sparkles, Check, AlertTriangle, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useSnippetStore } from '@/lib/store'
import { useKeywordStyleStore, type CasePreference } from '@/lib/keyword-style-store'
import { useAISettingsStore } from '@/lib/ai-settings-store'
import type { Snippet } from '@/types'

interface KeywordAuditModalProps {
  open: boolean
  onClose: () => void
}

type AuditStatus = 'missing' | 'inconsistent' | 'ok'

interface AuditResult {
  snippetId: string
  snippetName: string
  currentKeyword: string | undefined
  status: AuditStatus
  statusReason?: string
  suggestions?: string[]
}

interface StyleGuide {
  prefix?: string
  maxLength?: number
  case?: 'lower' | 'upper' | 'camel'
  examples: Array<{ name: string; keyword: string }>
}

const BATCH_SIZE = 3

function checkKeywordStyle(
  keyword: string | undefined,
  prefs: { prefix: string; maxLength: number; casePreference: CasePreference }
): { consistent: boolean; reason?: string } {
  if (!keyword || !keyword.trim()) {
    return { consistent: true } // Missing handled separately
  }

  const kw = keyword.trim()

  // Check prefix
  if (prefs.prefix && !kw.startsWith(prefs.prefix)) {
    return { consistent: false, reason: `Missing prefix "${prefs.prefix}"` }
  }

  // Check length
  if (kw.length > prefs.maxLength) {
    return { consistent: false, reason: `Too long (${kw.length} > ${prefs.maxLength})` }
  }

  // Check case (on the part after prefix)
  const core = prefs.prefix ? kw.slice(prefs.prefix.length) : kw
  if (core.length > 0) {
    if (prefs.casePreference === 'lowercase' && core !== core.toLowerCase()) {
      return { consistent: false, reason: 'Not lowercase' }
    }
    if (prefs.casePreference === 'UPPERCASE' && core !== core.toUpperCase()) {
      return { consistent: false, reason: 'Not UPPERCASE' }
    }
    if (prefs.casePreference === 'camelCase') {
      // camelCase: first char lowercase, rest can have uppercase
      if (core[0] !== core[0].toLowerCase()) {
        return { consistent: false, reason: 'Not camelCase' }
      }
    }
  }

  return { consistent: true }
}

export function KeywordAuditModal({ open, onClose }: KeywordAuditModalProps) {
  const snippets = useSnippetStore((s) => s.snippets)
  const updateSnippet = useSnippetStore((s) => s.updateSnippet)

  const keywordPrefix = useKeywordStyleStore((s) => s.prefix)
  const keywordMaxLength = useKeywordStyleStore((s) => s.maxLength)
  const keywordCase = useKeywordStyleStore((s) => s.casePreference)
  const loadPrefs = useKeywordStyleStore((s) => s.load)

  const ollamaUrl = useAISettingsStore((s) => s.ollamaUrl)
  const ollamaModel = useAISettingsStore((s) => s.ollamaModel)
  const loadAISettings = useAISettingsStore((s) => s.load)

  const [auditResults, setAuditResults] = useState<AuditResult[]>([])
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 })

  // Load stores on open
  useEffect(() => {
    if (open) {
      loadPrefs()
      loadAISettings()
    }
  }, [open, loadPrefs, loadAISettings])

  // Audit snippets when modal opens or prefs change
  useEffect(() => {
    if (!open) return

    const prefs = { prefix: keywordPrefix, maxLength: keywordMaxLength, casePreference: keywordCase }
    const results: AuditResult[] = snippets.map((s) => {
      const hasKeyword = s.keyword && s.keyword.trim().length > 0

      if (!hasKeyword) {
        return {
          snippetId: s.id,
          snippetName: s.name,
          currentKeyword: undefined,
          status: 'missing' as AuditStatus,
        }
      }

      const styleCheck = checkKeywordStyle(s.keyword, prefs)
      if (!styleCheck.consistent) {
        return {
          snippetId: s.id,
          snippetName: s.name,
          currentKeyword: s.keyword,
          status: 'inconsistent' as AuditStatus,
          statusReason: styleCheck.reason,
        }
      }

      return {
        snippetId: s.id,
        snippetName: s.name,
        currentKeyword: s.keyword,
        status: 'ok' as AuditStatus,
      }
    })

    setAuditResults(results)
  }, [open, snippets, keywordPrefix, keywordMaxLength, keywordCase])

  // Group results
  const groupedResults = useMemo(() => {
    const missing = auditResults.filter((r) => r.status === 'missing')
    const inconsistent = auditResults.filter((r) => r.status === 'inconsistent')
    const ok = auditResults.filter((r) => r.status === 'ok')
    return { missing, inconsistent, ok }
  }, [auditResults])

  const problemCount = groupedResults.missing.length + groupedResults.inconsistent.length

  // Build style guide for API
  const styleGuide = useMemo((): StyleGuide => {
    const caseMap: Record<CasePreference, 'lower' | 'upper' | 'camel'> = {
      lowercase: 'lower',
      UPPERCASE: 'upper',
      camelCase: 'camel',
    }

    const examples = snippets
      .filter((s) => s.keyword && s.keyword.trim())
      .map((s) => ({ name: s.name, keyword: s.keyword! }))
      .slice(0, 5)

    return {
      prefix: keywordPrefix || undefined,
      maxLength: keywordMaxLength,
      case: caseMap[keywordCase],
      examples,
    }
  }, [snippets, keywordPrefix, keywordMaxLength, keywordCase])

  // Fetch suggestions for a single snippet
  const fetchSuggestionsForSnippet = useCallback(
    async (snippet: Snippet): Promise<string[]> => {
      try {
        const res = await fetch('/api/suggest-keyword', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: snippet.name,
            text: snippet.text,
            styleGuide,
            ollamaUrl,
            model: ollamaModel,
          }),
        })
        const data = await res.json()
        return data.suggestions || []
      } catch {
        return []
      }
    },
    [styleGuide, ollamaUrl, ollamaModel]
  )

  // Batch scan for suggestions
  const handleScanAndSuggest = async () => {
    const problemResults = auditResults.filter((r) => r.status !== 'ok')
    if (problemResults.length === 0) {
      toast.info('No issues to scan')
      return
    }

    setScanning(true)
    setScanProgress({ current: 0, total: problemResults.length })

    const updatedResults = [...auditResults]

    // Process in batches
    for (let i = 0; i < problemResults.length; i += BATCH_SIZE) {
      const batch = problemResults.slice(i, i + BATCH_SIZE)
      const batchPromises = batch.map(async (result) => {
        const snippet = snippets.find((s) => s.id === result.snippetId)
        if (!snippet) return { snippetId: result.snippetId, suggestions: [] }

        const suggestions = await fetchSuggestionsForSnippet(snippet)
        return { snippetId: result.snippetId, suggestions }
      })

      const batchResults = await Promise.all(batchPromises)

      // Update results with suggestions
      for (const br of batchResults) {
        const idx = updatedResults.findIndex((r) => r.snippetId === br.snippetId)
        if (idx !== -1) {
          updatedResults[idx] = { ...updatedResults[idx], suggestions: br.suggestions }
        }
      }

      setScanProgress({ current: Math.min(i + BATCH_SIZE, problemResults.length), total: problemResults.length })
      setAuditResults([...updatedResults])
    }

    setScanning(false)
    toast.success(`Scanned ${problemResults.length} snippets`)
  }

  // Apply a single suggestion
  const handleApplySuggestion = (snippetId: string, keyword: string) => {
    updateSnippet(snippetId, { keyword })

    // Update local state
    setAuditResults((prev) =>
      prev.map((r) =>
        r.snippetId === snippetId
          ? { ...r, currentKeyword: keyword, status: 'ok' as AuditStatus, suggestions: undefined, statusReason: undefined }
          : r
      )
    )

    toast.success(`Updated keyword to "${keyword}"`)
  }

  // Apply all top suggestions
  const handleApplyAll = () => {
    const toApply = auditResults.filter(
      (r) => r.status !== 'ok' && r.suggestions && r.suggestions.length > 0
    )

    if (toApply.length === 0) {
      toast.info('No suggestions to apply')
      return
    }

    for (const result of toApply) {
      updateSnippet(result.snippetId, { keyword: result.suggestions![0] })
    }

    // Update local state
    setAuditResults((prev) =>
      prev.map((r) => {
        if (r.status !== 'ok' && r.suggestions && r.suggestions.length > 0) {
          return {
            ...r,
            currentKeyword: r.suggestions[0],
            status: 'ok' as AuditStatus,
            suggestions: undefined,
            statusReason: undefined,
          }
        }
        return r
      })
    )

    toast.success(`Applied ${toApply.length} suggestions`)
  }

  // Close on escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const applySuggestionsCount = auditResults.filter(
    (r) => r.status !== 'ok' && r.suggestions && r.suggestions.length > 0
  ).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-medium">Keyword Audit</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {snippets.length} snippets · {problemCount} need attention
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Actions bar */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-zinc-800 bg-zinc-900/50">
          <button
            onClick={handleScanAndSuggest}
            disabled={scanning || problemCount === 0}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm font-medium transition-colors"
          >
            {scanning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Scan & Suggest
          </button>

          {applySuggestionsCount > 0 && (
            <button
              onClick={handleApplyAll}
              disabled={scanning}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded text-sm font-medium transition-colors"
            >
              <Check className="w-4 h-4" />
              Apply All ({applySuggestionsCount})
            </button>
          )}

          {scanning && (
            <div className="flex-1 flex items-center gap-3">
              <div className="flex-1 bg-zinc-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-500 h-full transition-all"
                  style={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }}
                />
              </div>
              <span className="text-xs text-zinc-400">
                {scanProgress.current}/{scanProgress.total}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Missing keyword group */}
          {groupedResults.missing.length > 0 && (
            <section>
              <h3 className="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Missing keyword ({groupedResults.missing.length})
              </h3>
              <div className="space-y-2">
                {groupedResults.missing.map((result) => (
                  <AuditRow
                    key={result.snippetId}
                    result={result}
                    onApply={handleApplySuggestion}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Inconsistent style group */}
          {groupedResults.inconsistent.length > 0 && (
            <section>
              <h3 className="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-3">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                Inconsistent style ({groupedResults.inconsistent.length})
              </h3>
              <div className="space-y-2">
                {groupedResults.inconsistent.map((result) => (
                  <AuditRow
                    key={result.snippetId}
                    result={result}
                    onApply={handleApplySuggestion}
                  />
                ))}
              </div>
            </section>
          )}

          {/* OK group */}
          {groupedResults.ok.length > 0 && (
            <section>
              <h3 className="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-3">
                <CheckCircle className="w-4 h-4 text-green-500" />
                OK ({groupedResults.ok.length})
              </h3>
              <div className="space-y-2">
                {groupedResults.ok.map((result) => (
                  <AuditRow
                    key={result.snippetId}
                    result={result}
                    onApply={handleApplySuggestion}
                    collapsed
                  />
                ))}
              </div>
            </section>
          )}

          {snippets.length === 0 && (
            <div className="text-center text-zinc-500 py-8">No snippets to audit</div>
          )}
        </div>
      </div>
    </div>
  )
}

interface AuditRowProps {
  result: AuditResult
  onApply: (snippetId: string, keyword: string) => void
  collapsed?: boolean
}

function AuditRow({ result, onApply, collapsed = false }: AuditRowProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded bg-zinc-800/50',
        collapsed && 'opacity-60'
      )}
    >
      {/* Snippet name */}
      <div className="flex-1 min-w-0">
        <span className="text-sm text-zinc-200 truncate block">{result.snippetName}</span>
        {result.statusReason && (
          <span className="text-xs text-orange-400">{result.statusReason}</span>
        )}
      </div>

      {/* Current keyword */}
      <div className="w-24 shrink-0 text-right">
        {result.currentKeyword ? (
          <code className="text-xs bg-zinc-700 px-1.5 py-0.5 rounded text-zinc-300">
            {result.currentKeyword}
          </code>
        ) : (
          <span className="text-xs text-zinc-500">—</span>
        )}
      </div>

      {/* Status badge */}
      <StatusBadge status={result.status} />

      {/* Suggestions */}
      {result.suggestions && result.suggestions.length > 0 && (
        <div className="flex items-center gap-1.5">
          {result.suggestions.slice(0, 3).map((suggestion, idx) => (
            <button
              key={suggestion}
              onClick={() => onApply(result.snippetId, suggestion)}
              className={cn(
                'px-2 py-0.5 rounded-full text-xs transition-colors cursor-pointer',
                idx === 0
                  ? 'bg-green-700/50 hover:bg-green-600/60 text-green-200'
                  : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'
              )}
              title={idx === 0 ? 'Top suggestion' : undefined}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: AuditStatus }) {
  const config = {
    missing: { label: 'Missing', className: 'bg-amber-900/50 text-amber-300' },
    inconsistent: { label: 'Style', className: 'bg-orange-900/50 text-orange-300' },
    ok: { label: 'OK', className: 'bg-green-900/50 text-green-300' },
  }

  const { label, className } = config[status]

  return (
    <span className={cn('px-2 py-0.5 rounded text-xs font-medium', className)}>{label}</span>
  )
}
