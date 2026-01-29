/**
 * Raycast Placeholder Parser
 * Parses placeholder syntax into structured data for visualization
 */

export type PlaceholderType =
  | 'clipboard'
  | 'cursor'
  | 'date'
  | 'time'
  | 'datetime'
  | 'day'
  | 'uuid'
  | 'selection'
  | 'argument'
  | 'snippet'

export type PlaceholderModifier =
  | 'uppercase'
  | 'lowercase'
  | 'trim'
  | 'percent-encode'
  | 'json-stringify'
  | 'raw'

export interface PlaceholderAttribute {
  name: string
  value: string
}

export interface ParsedPlaceholder {
  raw: string
  type: PlaceholderType
  attributes: PlaceholderAttribute[]
  modifiers: PlaceholderModifier[]
  // For snippet type, the referenced snippet name
  snippetRef?: string
  // For argument type, the argument name
  argumentName?: string
}

const PLACEHOLDER_TYPES: PlaceholderType[] = [
  'clipboard',
  'cursor',
  'date',
  'time',
  'datetime',
  'day',
  'uuid',
  'selection',
  'argument',
  'snippet',
]

const MODIFIERS: PlaceholderModifier[] = [
  'uppercase',
  'lowercase',
  'trim',
  'percent-encode',
  'json-stringify',
  'raw',
]

// Regex to match Raycast placeholders
const PLACEHOLDER_REGEX =
  /\{(clipboard|cursor|date|time|datetime|day|uuid|selection|argument|snippet)(\s+[^}]*)?\}/g

// Regex to parse attributes like: name="value" or offset=N
const ATTR_REGEX = /(\w+(?:-\w+)?)=(?:"([^"]*)"|(\S+))/g

// Regex to find modifiers (standalone words that match modifier list)
const MODIFIER_REGEX = /\b(uppercase|lowercase|trim|percent-encode|json-stringify|raw)\b/g

export function parsePlaceholder(raw: string): ParsedPlaceholder | null {
  const match = raw.match(
    /^\{(clipboard|cursor|date|time|datetime|day|uuid|selection|argument|snippet)(\s+[^}]*)?\}$/
  )
  if (!match) return null

  const type = match[1] as PlaceholderType
  const attrString = match[2] || ''

  const attributes: PlaceholderAttribute[] = []
  const modifiers: PlaceholderModifier[] = []

  // Parse attributes
  let attrMatch: RegExpExecArray | null
  while ((attrMatch = ATTR_REGEX.exec(attrString)) !== null) {
    attributes.push({
      name: attrMatch[1],
      value: attrMatch[2] ?? attrMatch[3],
    })
  }
  ATTR_REGEX.lastIndex = 0

  // Parse modifiers
  let modMatch: RegExpExecArray | null
  while ((modMatch = MODIFIER_REGEX.exec(attrString)) !== null) {
    modifiers.push(modMatch[1] as PlaceholderModifier)
  }
  MODIFIER_REGEX.lastIndex = 0

  const result: ParsedPlaceholder = {
    raw,
    type,
    attributes,
    modifiers,
  }

  // Extract special fields
  if (type === 'snippet') {
    const nameAttr = attributes.find((a) => a.name === 'name')
    if (nameAttr) result.snippetRef = nameAttr.value
  }
  if (type === 'argument') {
    const nameAttr = attributes.find((a) => a.name === 'name')
    if (nameAttr) result.argumentName = nameAttr.value
  }

  return result
}

export interface PlaceholderMatch {
  placeholder: ParsedPlaceholder
  start: number
  end: number
}

export function findPlaceholders(text: string): PlaceholderMatch[] {
  const matches: PlaceholderMatch[] = []

  let match: RegExpExecArray | null
  while ((match = PLACEHOLDER_REGEX.exec(text)) !== null) {
    const parsed = parsePlaceholder(match[0])
    if (parsed) {
      matches.push({
        placeholder: parsed,
        start: match.index,
        end: match.index + match[0].length,
      })
    }
  }
  PLACEHOLDER_REGEX.lastIndex = 0

  return matches
}

// Human-readable label for placeholder type
export function getPlaceholderLabel(type: PlaceholderType): string {
  const labels: Record<PlaceholderType, string> = {
    clipboard: 'Clipboard',
    cursor: 'Cursor',
    date: 'Date',
    time: 'Time',
    datetime: 'Date/Time',
    day: 'Day',
    uuid: 'UUID',
    selection: 'Selection',
    argument: 'Input',
    snippet: 'Snippet',
  }
  return labels[type]
}

// Short description for tooltip
export function getPlaceholderDescription(parsed: ParsedPlaceholder): string {
  const { type, attributes, modifiers, snippetRef, argumentName } = parsed

  let desc = ''

  switch (type) {
    case 'clipboard':
      desc = 'Pastes clipboard content'
      const offsetAttr = attributes.find((a) => a.name === 'offset')
      if (offsetAttr) desc += ` (history #${offsetAttr.value})`
      break
    case 'cursor':
      desc = 'Positions cursor here after paste'
      break
    case 'date':
      desc = 'Current date'
      const formatAttr = attributes.find((a) => a.name === 'format')
      if (formatAttr) desc += ` (${formatAttr.value})`
      const dateOffsetAttr = attributes.find((a) => a.name === 'offset')
      if (dateOffsetAttr) desc += ` offset: ${dateOffsetAttr.value}`
      break
    case 'time':
      desc = 'Current time'
      break
    case 'datetime':
      desc = 'Current date and time'
      break
    case 'day':
      desc = 'Current day of week'
      break
    case 'uuid':
      desc = 'Generates random UUID'
      break
    case 'selection':
      desc = 'Selected text'
      break
    case 'argument':
      desc = argumentName ? `User input: "${argumentName}"` : 'User input prompt'
      break
    case 'snippet':
      desc = snippetRef ? `References snippet: "${snippetRef}"` : 'References another snippet'
      break
  }

  if (modifiers.length > 0) {
    desc += ` [${modifiers.join(', ')}]`
  }

  return desc
}

// Check if a placeholder type is valid
export function isValidPlaceholderType(type: string): type is PlaceholderType {
  return PLACEHOLDER_TYPES.includes(type as PlaceholderType)
}

// Check if a modifier is valid
export function isValidModifier(mod: string): mod is PlaceholderModifier {
  return MODIFIERS.includes(mod as PlaceholderModifier)
}

// Generate example preview value for a placeholder
export function getPlaceholderPreviewValue(parsed: ParsedPlaceholder): string {
  const { type, attributes, modifiers, snippetRef, argumentName } = parsed

  let value = ''

  switch (type) {
    case 'clipboard':
      value = '[clipboard]'
      const offsetAttr = attributes.find((a) => a.name === 'offset')
      if (offsetAttr) value = `[clipboard #${offsetAttr.value}]`
      break
    case 'cursor':
      value = '|' // cursor position indicator
      break
    case 'date': {
      const now = new Date()
      const formatAttr = attributes.find((a) => a.name === 'format')
      const dateOffsetAttr = attributes.find((a) => a.name === 'offset')
      // Apply offset if present (e.g., "1d" = 1 day, "-2w" = -2 weeks)
      if (dateOffsetAttr) {
        const offsetMatch = dateOffsetAttr.value.match(/^(-?\d+)([dwmy])$/)
        if (offsetMatch) {
          const num = parseInt(offsetMatch[1], 10)
          const unit = offsetMatch[2]
          if (unit === 'd') now.setDate(now.getDate() + num)
          else if (unit === 'w') now.setDate(now.getDate() + num * 7)
          else if (unit === 'm') now.setMonth(now.getMonth() + num)
          else if (unit === 'y') now.setFullYear(now.getFullYear() + num)
        }
      }
      // Format the date
      if (formatAttr) {
        // Simple format substitution
        value = formatAttr.value
          .replace(/YYYY/g, String(now.getFullYear()))
          .replace(/MM/g, String(now.getMonth() + 1).padStart(2, '0'))
          .replace(/DD/g, String(now.getDate()).padStart(2, '0'))
          .replace(/M/g, String(now.getMonth() + 1))
          .replace(/D/g, String(now.getDate()))
      } else {
        value = now.toLocaleDateString()
      }
      break
    }
    case 'time': {
      const now = new Date()
      value = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      break
    }
    case 'datetime': {
      const now = new Date()
      value = `${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      break
    }
    case 'day': {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      value = days[new Date().getDay()]
      break
    }
    case 'uuid':
      value = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
      break
    case 'selection':
      value = '[selected text]'
      break
    case 'argument':
      value = argumentName ? `[${argumentName}]` : '[input]'
      break
    case 'snippet':
      value = snippetRef ? `[${snippetRef}]` : '[snippet]'
      break
  }

  // Apply modifiers
  for (const mod of modifiers) {
    switch (mod) {
      case 'uppercase':
        value = value.toUpperCase()
        break
      case 'lowercase':
        value = value.toLowerCase()
        break
      case 'trim':
        value = value.trim()
        break
      // Other modifiers don't visually transform the preview
    }
  }

  return value
}
