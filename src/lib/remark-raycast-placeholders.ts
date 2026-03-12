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

        // The placeholder as a custom MDAST node with hName/hProperties
        // so remark-rehype converts it to a <raycast-placeholder> hast element
        // without needing rehype-raw (which would also render user XML tags)
        newNodes.push({
          type: 'text',
          value: '',
          data: {
            hName: 'raycast-placeholder',
            hProperties: {
              raw: match.placeholder.raw,
              parsed: JSON.stringify(match.placeholder),
            },
          },
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
