import { useSnippetStore } from './store'

export interface KeywordConflict {
  conflict: boolean
  existingSnippet?: { id: string; name: string }
}

/**
 * Check if a keyword is already used by another snippet
 * @param keyword - The keyword to check
 * @param excludeSnippetId - Optional snippet ID to exclude (e.g., the current snippet being edited)
 * @returns Conflict info with the existing snippet if found
 */
export function checkKeywordConflict(
  keyword: string,
  excludeSnippetId?: string
): KeywordConflict {
  if (!keyword?.trim()) {
    return { conflict: false }
  }

  const normalizedKeyword = keyword.trim().toLowerCase()
  const snippets = useSnippetStore.getState().snippets

  const existing = snippets.find(
    (s) =>
      s.id !== excludeSnippetId &&
      s.keyword?.trim().toLowerCase() === normalizedKeyword
  )

  if (existing) {
    return {
      conflict: true,
      existingSnippet: { id: existing.id, name: existing.name },
    }
  }

  return { conflict: false }
}

/**
 * Check multiple keywords for conflicts at once
 */
export function checkKeywordConflicts(
  keywords: string[],
  excludeSnippetId?: string
): Map<string, KeywordConflict> {
  const results = new Map<string, KeywordConflict>()

  for (const keyword of keywords) {
    results.set(keyword, checkKeywordConflict(keyword, excludeSnippetId))
  }

  return results
}
