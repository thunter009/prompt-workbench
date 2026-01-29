/**
 * Remark plugin to transform Raycast placeholders into custom nodes
 * These nodes are then rendered as PlaceholderPill components in react-markdown
 */

import { visit } from 'unist-util-visit'
import { findPlaceholders } from '@/lib/raycast/placeholder-parser'
import type { Root, Text, PhrasingContent } from 'mdast'

export function remarkRaycastPlaceholders() {
  return (tree: Root) => {
    visit(tree, 'text', (node: Text, index, parent) => {
      if (!parent || index === undefined) return

      const { value } = node
      const matches = findPlaceholders(value)

      if (matches.length === 0) return

      // Build new nodes array, replacing text with placeholder nodes where found
      const newNodes: PhrasingContent[] = []
      let lastEnd = 0

      for (const match of matches) {
        // Text before this placeholder
        if (match.start > lastEnd) {
          newNodes.push({
            type: 'text',
            value: value.slice(lastEnd, match.start),
          })
        }

        // The placeholder as a custom node
        // We use html node type for custom rendering
        newNodes.push({
          type: 'html',
          value: `<raycast-placeholder raw="${escapeAttr(match.placeholder.raw)}" parsed="${escapeAttr(JSON.stringify(match.placeholder))}"></raycast-placeholder>`,
        } as PhrasingContent)

        lastEnd = match.end
      }

      // Text after last placeholder
      if (lastEnd < value.length) {
        newNodes.push({
          type: 'text',
          value: value.slice(lastEnd),
        })
      }

      // Replace the original text node with our new nodes
      parent.children.splice(index, 1, ...newNodes)
    })
  }
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
