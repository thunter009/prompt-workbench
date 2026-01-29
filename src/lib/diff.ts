import { diffLines, diffWords, type Change } from 'diff'

export type DiffChange = Change

export interface DiffResult {
  changes: DiffChange[]
  addedLines: number
  removedLines: number
}

// Compute line-level diff between two texts
export function computeLineDiff(oldText: string, newText: string): DiffResult {
  const changes = diffLines(oldText, newText)

  let addedLines = 0
  let removedLines = 0

  for (const change of changes) {
    if (change.added) {
      addedLines += change.count ?? 0
    } else if (change.removed) {
      removedLines += change.count ?? 0
    }
  }

  return { changes, addedLines, removedLines }
}

// Compute word-level diff (more granular)
export function computeWordDiff(oldText: string, newText: string): DiffResult {
  const changes = diffWords(oldText, newText)

  let addedLines = 0
  let removedLines = 0

  for (const change of changes) {
    if (change.added) {
      addedLines += (change.value.match(/\n/g) || []).length
    } else if (change.removed) {
      removedLines += (change.value.match(/\n/g) || []).length
    }
  }

  return { changes, addedLines, removedLines }
}
