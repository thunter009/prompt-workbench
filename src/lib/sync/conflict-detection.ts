import type { Snippet, RaycastSnippet, SnippetConflict, ConflictType } from '@/types'

// Inline type to avoid importing from file-watcher (Node.js module)
export interface FileChangeEvent {
  type: 'add' | 'change' | 'unlink'
  path: string
  timestamp: number
}

export interface ParsedRaycastFile {
  path: string
  snippets: RaycastSnippet[]
  error?: string
}

// Parse a Raycast JSON file content
export function parseRaycastFile(content: string, filePath: string): ParsedRaycastFile {
  try {
    const data = JSON.parse(content)
    // Raycast exports are arrays of snippet objects
    if (Array.isArray(data)) {
      return { path: filePath, snippets: data }
    }
    // Single snippet object
    if (data && typeof data === 'object' && 'name' in data && 'text' in data) {
      return { path: filePath, snippets: [data] }
    }
    return { path: filePath, snippets: [], error: 'Invalid format' }
  } catch {
    return { path: filePath, snippets: [], error: 'Parse error' }
  }
}

// Match remote snippet to local by name (primary) or keyword
export function findMatchingLocal(
  remote: RaycastSnippet,
  locals: Snippet[]
): Snippet | undefined {
  // Exact name match first
  const byName = locals.find((l) => l.name === remote.name)
  if (byName) return byName
  // Keyword match if both have keywords
  if (remote.keyword) {
    return locals.find((l) => l.keyword === remote.keyword)
  }
  return undefined
}

// Check if content differs (ignoring whitespace normalization)
export function hasContentDiff(local: Snippet, remote: RaycastSnippet): boolean {
  const normalize = (s: string) => s.trim()
  if (normalize(local.text) !== normalize(remote.text)) return true
  if (local.name !== remote.name) return true
  if ((local.keyword || '') !== (remote.keyword || '')) return true
  return false
}

// Detect conflicts from file change events
export function detectConflicts(
  events: FileChangeEvent[],
  fileContents: Map<string, string>, // path -> file content
  localSnippets: Snippet[]
): SnippetConflict[] {
  const conflicts: SnippetConflict[] = []
  const now = Date.now()

  for (const event of events) {
    const content = fileContents.get(event.path)

    if (event.type === 'unlink') {
      // File deleted in Raycast - find matching local snippets
      // We need to check which snippets were exported to this file
      // For now, we can't determine this without tracking export destinations
      // Skip unlink events for now - they need export path tracking
      continue
    }

    if (event.type === 'add' || event.type === 'change') {
      if (!content) continue

      const parsed = parseRaycastFile(content, event.path)
      if (parsed.error) continue

      for (const remoteSnippet of parsed.snippets) {
        const localMatch = findMatchingLocal(remoteSnippet, localSnippets)

        if (!localMatch) {
          // New snippet from Raycast that doesn't exist locally
          conflicts.push({
            id: crypto.randomUUID(),
            type: 'new_remote',
            remoteSnippet,
            filePath: event.path,
            detectedAt: now,
          })
        } else if (hasContentDiff(localMatch, remoteSnippet)) {
          // Both exist but content differs - check timestamps
          const localModifiedAfterExport =
            localMatch.lastExportedAt && localMatch.updatedAt > localMatch.lastExportedAt

          if (localModifiedAfterExport) {
            // Both modified - true conflict
            conflicts.push({
              id: crypto.randomUUID(),
              type: 'modified',
              localSnippet: localMatch,
              remoteSnippet,
              filePath: event.path,
              detectedAt: now,
            })
          } else {
            // Only remote modified - still show as conflict for user awareness
            conflicts.push({
              id: crypto.randomUUID(),
              type: 'modified',
              localSnippet: localMatch,
              remoteSnippet,
              filePath: event.path,
              detectedAt: now,
            })
          }
        }
        // If no diff, no conflict - snippets are in sync
      }
    }
  }

  return conflicts
}

// Get display label for conflict type
export function getConflictLabel(type: ConflictType): string {
  switch (type) {
    case 'modified':
      return 'Modified'
    case 'deleted_local':
      return 'Deleted locally'
    case 'deleted_remote':
      return 'Deleted in Raycast'
    case 'new_remote':
      return 'New from Raycast'
  }
}
