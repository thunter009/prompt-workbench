import { autocompletion, completionKeymap, CompletionContext, type Completion } from '@codemirror/autocomplete'
import { EditorView, keymap } from '@codemirror/view'
import { Prec } from '@codemirror/state'

const PLACEHOLDER_COMPLETIONS: Completion[] = [
  { label: '{clipboard}', detail: 'Clipboard content', type: 'keyword' },
  { label: '{clipboard offset=1}', detail: 'Clipboard history', type: 'keyword' },
  { label: '{cursor}', detail: 'Cursor position after paste', type: 'keyword' },
  { label: '{date}', detail: 'Current date', type: 'keyword' },
  { label: '{date format="yyyy-MM-dd"}', detail: 'Formatted date', type: 'keyword' },
  { label: '{time}', detail: 'Current time', type: 'keyword' },
  { label: '{datetime}', detail: 'Current date and time', type: 'keyword' },
  { label: '{day}', detail: 'Day of week', type: 'keyword' },
  { label: '{uuid}', detail: 'Random UUID', type: 'keyword' },
  { label: '{selection}', detail: 'Selected text', type: 'keyword' },
  { label: '{argument}', detail: 'User input prompt', type: 'keyword' },
  { label: '{argument name=""}', detail: 'Named user input', type: 'keyword' },
  { label: '{snippet name=""}', detail: 'Reference another snippet', type: 'keyword' },
]

function completePlaceholder(context: CompletionContext) {
  // Match from the opening { up to the cursor
  const match = context.matchBefore(/\{[^}\s]*/)
  if (!match) return null

  return {
    from: match.from,
    options: PLACEHOLDER_COMPLETIONS,
    filter: true,
  }
}

const autocompleteTheme = EditorView.theme({
  '.cm-tooltip-autocomplete': {
    backgroundColor: 'rgb(24 24 27)',
    border: '1px solid rgb(63 63 70)',
    borderRadius: '6px',
    fontFamily: 'ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace',
    fontSize: '13px',
  },
  '.cm-tooltip-autocomplete ul': {
    maxHeight: '200px',
  },
  '.cm-tooltip-autocomplete ul li': {
    padding: '4px 8px',
    color: 'rgb(212 212 216)',
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    color: 'rgb(250 250 250)',
  },
  '.cm-completionLabel': {
    color: 'rgb(124, 58, 237)',
    fontWeight: '500',
  },
  '.cm-completionDetail': {
    color: 'rgb(161 161 170)',
    marginLeft: '8px',
    fontStyle: 'normal',
  },
})

export const placeholderAutocomplete = [
  autocompletion({
    override: [completePlaceholder],
    activateOnTyping: true,
    icons: false,
  }),
  Prec.highest(keymap.of(completionKeymap)),
  autocompleteTheme,
]
