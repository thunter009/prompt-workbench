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
