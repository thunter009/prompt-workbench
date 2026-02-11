/**
 * Snippet Resolution Engine
 * Resolves {snippet name="..."} references to actual snippet text.
 * Pure function - no side effects, no store access.
 */

import type { Snippet } from '@/types'
import { findPlaceholders } from '@/lib/raycast/placeholder-parser'

const MAX_DEPTH = 10

export interface ResolutionError {
  snippetName: string
  error: 'not_found' | 'circular' | 'max_depth'
}

export interface ResolutionResult {
  text: string
  errors: ResolutionError[]
}

/**
 * Resolve all {snippet name="..."} placeholders in a snippet's text,
 * recursively expanding nested snippet references.
 */
export function resolveSnippetIncludes(
  text: string,
  snippets: Snippet[],
): ResolutionResult {
  const byName = new Map<string, Snippet>()
  for (const s of snippets) {
    byName.set(s.name, s)
  }

  const errors: ResolutionError[] = []
  const resolved = resolve(text, byName, [], errors)
  return { text: resolved, errors }
}

function resolve(
  text: string,
  byName: Map<string, Snippet>,
  chain: string[],
  errors: ResolutionError[],
): string {
  const matches = findPlaceholders(text)
  const snippetMatches = matches.filter((m) => m.placeholder.type === 'snippet' && m.placeholder.snippetRef)

  if (snippetMatches.length === 0) return text

  // Replace in reverse order to preserve indices
  let result = text
  for (let i = snippetMatches.length - 1; i >= 0; i--) {
    const match = snippetMatches[i]
    const name = match.placeholder.snippetRef!

    if (chain.includes(name)) {
      errors.push({ snippetName: name, error: 'circular' })
      continue
    }

    if (chain.length >= MAX_DEPTH) {
      errors.push({ snippetName: name, error: 'max_depth' })
      continue
    }

    const target = byName.get(name)
    if (!target) {
      errors.push({ snippetName: name, error: 'not_found' })
      continue
    }

    const expanded = resolve(target.text, byName, [...chain, name], errors)
    result = result.slice(0, match.start) + expanded + result.slice(match.end)
  }

  return result
}
