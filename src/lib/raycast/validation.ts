import type { Snippet } from '@/types'

export const RAYCAST_CHAR_LIMIT = 65536

export type ValidationSeverity = 'error' | 'warning'

export interface ValidationIssue {
  snippetId: string
  snippetName: string
  field: 'name' | 'text' | 'keyword'
  severity: ValidationSeverity
  message: string
}

export interface ValidationResult {
  valid: boolean // false if any errors (warnings don't block)
  issues: ValidationIssue[]
  errorCount: number
  warningCount: number
}

export function validateSnippet(snippet: Snippet): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  // Critical: name must be present
  if (!snippet.name || !snippet.name.trim()) {
    issues.push({
      snippetId: snippet.id,
      snippetName: snippet.name || '(unnamed)',
      field: 'name',
      severity: 'error',
      message: 'Name is required',
    })
  }

  // Critical: text must be present
  if (!snippet.text || !snippet.text.trim()) {
    issues.push({
      snippetId: snippet.id,
      snippetName: snippet.name || '(unnamed)',
      field: 'text',
      severity: 'error',
      message: 'Text content is required',
    })
  }

  // Critical: text must not exceed char limit
  if (snippet.text && snippet.text.length > RAYCAST_CHAR_LIMIT) {
    issues.push({
      snippetId: snippet.id,
      snippetName: snippet.name || '(unnamed)',
      field: 'text',
      severity: 'error',
      message: `Text exceeds ${RAYCAST_CHAR_LIMIT.toLocaleString()} character limit (${snippet.text.length.toLocaleString()} chars)`,
    })
  }

  // Warning: no keyword set
  if (!snippet.keyword || !snippet.keyword.trim()) {
    issues.push({
      snippetId: snippet.id,
      snippetName: snippet.name || '(unnamed)',
      field: 'keyword',
      severity: 'warning',
      message: 'No keyword set (snippet may be hard to trigger)',
    })
  }

  return issues
}

export function validateSnippets(snippets: Snippet[]): ValidationResult {
  const allIssues: ValidationIssue[] = []

  for (const snippet of snippets) {
    allIssues.push(...validateSnippet(snippet))
  }

  const errorCount = allIssues.filter((i) => i.severity === 'error').length
  const warningCount = allIssues.filter((i) => i.severity === 'warning').length

  return {
    valid: errorCount === 0,
    issues: allIssues,
    errorCount,
    warningCount,
  }
}
