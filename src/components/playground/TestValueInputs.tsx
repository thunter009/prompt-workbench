'use client'

import { useMemo } from 'react'
import { RefreshCw } from 'lucide-react'
import { findPlaceholders, getPlaceholderLabel } from '@/lib/raycast/placeholder-parser'
import type { ParsedPlaceholder } from '@/lib/raycast/placeholder-parser'
import { usePlaygroundStore } from '@/lib/playground-store'
import { useSnippetStore } from '@/lib/store'
import { generateId } from '@/lib/utils/id'

interface PlaceholderField {
  key: string
  label: string
  type: 'textarea' | 'text' | 'readonly'
  defaultValue: () => string
  regeneratable?: boolean
}

function placeholderKey(p: ParsedPlaceholder): string {
  if (p.type === 'argument') return `argument:${p.argumentName ?? ''}`
  if (p.type === 'snippet') return `snippet:${p.snippetRef ?? ''}`
  return p.type
}

function getDefaultValue(p: ParsedPlaceholder, snippets: { name: string; text: string }[]): () => string {
  switch (p.type) {
    case 'clipboard':
    case 'selection':
      return () => ''
    case 'argument':
      return () => ''
    case 'date':
      return () => new Date().toLocaleDateString()
    case 'time':
      return () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    case 'datetime':
      return () => {
        const now = new Date()
        return `${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      }
    case 'day':
      return () => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()]
    case 'uuid':
      return () => generateId()
    case 'snippet': {
      const ref = p.snippetRef
      if (!ref) return () => ''
      const s = snippets.find((s) => s.name === ref)
      return () => s?.text ?? `[snippet "${ref}" not found]`
    }
    default:
      return () => ''
  }
}

function buildFields(text: string, snippets: { name: string; text: string }[]): PlaceholderField[] {
  const matches = findPlaceholders(text)
  const seen = new Set<string>()
  const fields: PlaceholderField[] = []

  for (const m of matches) {
    const p = m.placeholder
    if (p.type === 'cursor') continue

    const key = placeholderKey(p)
    if (seen.has(key)) continue
    seen.add(key)

    const label = p.type === 'argument'
      ? p.argumentName ?? 'Input'
      : p.type === 'snippet'
        ? `Snippet: ${p.snippetRef ?? '?'}`
        : getPlaceholderLabel(p.type)

    const isTextarea = p.type === 'clipboard' || p.type === 'selection'
    const isReadonly = p.type === 'snippet'

    fields.push({
      key,
      label,
      type: isReadonly ? 'readonly' : isTextarea ? 'textarea' : 'text',
      defaultValue: getDefaultValue(p, snippets),
      regeneratable: p.type === 'uuid',
    })
  }

  return fields
}

interface TestValueInputsProps {
  snippetId: string
  text: string
}

export function TestValueInputs({ snippetId, text }: TestValueInputsProps) {
  const snippets = useSnippetStore((s) => s.snippets)
  const setTestValue = usePlaygroundStore((s) => s.setTestValue)
  const testValues = usePlaygroundStore((s) => s.getTestValues(snippetId))

  const fields = useMemo(
    () => buildFields(text, snippets),
    [text, snippets]
  )

  // Auto-fill defaults for fields that don't have stored values
  useMemo(() => {
    for (const f of fields) {
      if (testValues[f.key] === undefined) {
        const val = f.defaultValue()
        if (val) setTestValue(snippetId, f.key, val)
      }
    }
  }, [fields, snippetId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (fields.length === 0) return null

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Test Values
      </h3>
      {fields.map((f) => (
        <div key={f.key} className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-secondary-foreground">
              {f.label}
            </label>
            {f.regeneratable && (
              <button
                onClick={() => setTestValue(snippetId, f.key, f.defaultValue())}
                className="p-0.5 rounded text-muted-foreground hover:text-secondary-foreground hover:bg-accent transition-colors"
                title="Regenerate"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            )}
          </div>
          {f.type === 'textarea' ? (
            <textarea
              value={testValues[f.key] ?? ''}
              onChange={(e) => setTestValue(snippetId, f.key, e.target.value)}
              placeholder={`Enter ${f.label.toLowerCase()}...`}
              rows={2}
              className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded resize-y focus:outline-none focus:ring-1 focus:ring-ring"
            />
          ) : f.type === 'readonly' ? (
            <div className="w-full px-2 py-1.5 text-sm bg-background/50 border border-border rounded text-muted-foreground truncate">
              {testValues[f.key] ?? f.defaultValue()}
            </div>
          ) : (
            <input
              type="text"
              value={testValues[f.key] ?? ''}
              onChange={(e) => setTestValue(snippetId, f.key, e.target.value)}
              placeholder={`Enter ${f.label.toLowerCase()}...`}
              className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-ring"
            />
          )}
        </div>
      ))}
    </div>
  )
}
