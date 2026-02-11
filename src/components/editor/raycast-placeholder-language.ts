import {
  ViewPlugin,
  Decoration,
  DecorationSet,
  EditorView,
  ViewUpdate,
  MatchDecorator,
  hoverTooltip,
  type Tooltip,
} from "@codemirror/view";
import { useSnippetStore } from "@/lib/store";

/**
 * Raycast Placeholder Syntax
 *
 * Core placeholders:
 * - {clipboard}, {clipboard offset=N}
 * - {cursor}
 * - {date}, {date format="..."}, {date offset="+Nd"}
 * - {time}, {datetime}, {day}
 * - {uuid}, {selection}
 * - {argument}, {argument name="..."}
 * - {snippet name="..."}
 *
 * Modifiers: uppercase, lowercase, trim, percent-encode, json-stringify, raw
 */

// Regex to match Raycast placeholders
// Matches: {placeholderName} or {placeholderName attr="value" attr2="value2"}
const PLACEHOLDER_REGEX =
  /\{(clipboard|cursor|date|time|datetime|day|uuid|selection|argument|snippet)(\s+[^}]*)?\}/g;

// Type-specific decoration marks
const markCache: Record<string, Decoration> = {};
function markForType(type: string): Decoration {
  if (!markCache[type]) {
    markCache[type] = Decoration.mark({
      class: `cm-raycast-placeholder cm-raycast-placeholder-${type}`,
    });
  }
  return markCache[type];
}

// Map placeholder names to color categories
function placeholderCategory(name: string): string {
  switch (name) {
    case "clipboard":
      return "clipboard";
    case "argument":
      return "argument";
    case "snippet":
      return "snippet";
    case "date":
    case "time":
    case "datetime":
    case "day":
      return "date";
    case "cursor":
    case "uuid":
    case "selection":
      return "cursor";
    default:
      return "clipboard";
  }
}

// Create a match decorator that finds all placeholders
const placeholderMatcher = new MatchDecorator({
  regexp: PLACEHOLDER_REGEX,
  decoration: (m) => markForType(placeholderCategory(m[1])),
});

// View plugin that applies the decorations
export const raycastPlaceholderPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = placeholderMatcher.createDeco(view);
    }

    update(update: ViewUpdate) {
      this.decorations = placeholderMatcher.updateDeco(update, this.decorations);
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

/** Find snippet ref surrounding `pos` in the document, return name + range */
function snippetRefAt(
  view: EditorView,
  pos: number
): { name: string; from: number; to: number } | null {
  const line = view.state.doc.lineAt(pos);
  const text = line.text;
  // Search all snippet refs in the line
  const re = /\{snippet\s+name="([^"]+)"\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const from = line.from + m.index;
    const to = from + m[0].length;
    if (pos >= from && pos <= to) {
      return { name: m[1], from, to };
    }
  }
  return null;
}

// Hover tooltip: show snippet content preview
const snippetHoverTooltip = hoverTooltip(
  (view: EditorView, pos: number): Tooltip | null => {
    const ref = snippetRefAt(view, pos);
    if (!ref) return null;

    const { snippets } = useSnippetStore.getState();
    const snippet = snippets.find((s) => s.name === ref.name);

    return {
      pos: ref.from,
      end: ref.to,
      above: true,
      create() {
        const dom = document.createElement("div");
        dom.className = "cm-snippet-tooltip";

        if (snippet) {
          const title = document.createElement("div");
          title.className = "cm-snippet-tooltip-title";
          title.textContent = snippet.name;
          dom.appendChild(title);

          const preview = document.createElement("div");
          preview.className = "cm-snippet-tooltip-preview";
          // Truncate long snippets
          const text = snippet.text;
          preview.textContent =
            text.length > 200 ? text.slice(0, 200) + "…" : text;
          dom.appendChild(preview);

          const hint = document.createElement("div");
          hint.className = "cm-snippet-tooltip-hint";
          hint.textContent = "⌘+Click to jump";
          dom.appendChild(hint);
        } else {
          const notFound = document.createElement("div");
          notFound.className = "cm-snippet-tooltip-notfound";
          notFound.textContent = `Snippet "${ref.name}" not found`;
          dom.appendChild(notFound);
        }

        return { dom };
      },
    };
  },
  { hoverTime: 300 }
);

// Cmd+Click handler: navigate to referenced snippet
const snippetClickHandler = EditorView.domEventHandlers({
  mousedown(event: MouseEvent, view: EditorView) {
    if (!event.metaKey && !event.ctrlKey) return false;

    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos === null) return false;

    const ref = snippetRefAt(view, pos);
    if (!ref) return false;

    const { snippets, selectSnippet } = useSnippetStore.getState();
    const snippet = snippets.find((s) => s.name === ref.name);
    if (!snippet) return false;

    event.preventDefault();
    selectSnippet(snippet.id);
    return true;
  },
});

// Theme for placeholder styling — type-aware colors
export const raycastPlaceholderTheme = EditorView.baseTheme({
  ".cm-raycast-placeholder": {
    borderRadius: "3px",
    padding: "0 2px",
    fontWeight: "500",
  },
  // clipboard — purple (default/original)
  ".cm-raycast-placeholder-clipboard": {
    backgroundColor: "rgba(124, 58, 237, 0.15)",
    color: "rgb(124, 58, 237)",
  },
  // argument — amber
  ".cm-raycast-placeholder-argument": {
    backgroundColor: "rgba(217, 119, 6, 0.15)",
    color: "rgb(217, 119, 6)",
  },
  // snippet — teal
  ".cm-raycast-placeholder-snippet": {
    backgroundColor: "rgba(13, 148, 136, 0.15)",
    color: "rgb(13, 148, 136)",
  },
  // date/time — blue
  ".cm-raycast-placeholder-date": {
    backgroundColor: "rgba(37, 99, 235, 0.15)",
    color: "rgb(37, 99, 235)",
  },
  // cursor/uuid/selection — rose
  ".cm-raycast-placeholder-cursor": {
    backgroundColor: "rgba(225, 29, 72, 0.15)",
    color: "rgb(225, 29, 72)",
  },
  "&.cm-focused .cm-raycast-placeholder": {
    filter: "brightness(1.1)",
  },
  // Snippet tooltip styles
  ".cm-snippet-tooltip": {
    maxWidth: "360px",
    padding: "8px 12px",
    backgroundColor: "rgb(24 24 27)",
    border: "1px solid rgb(63 63 70)",
    borderRadius: "6px",
    fontFamily:
      "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace",
    fontSize: "13px",
    color: "rgb(212 212 216)",
    zIndex: "50",
  },
  ".cm-snippet-tooltip-title": {
    fontWeight: "600",
    color: "rgb(124, 58, 237)",
    marginBottom: "4px",
  },
  ".cm-snippet-tooltip-preview": {
    whiteSpace: "pre-wrap",
    lineHeight: "1.4",
    maxHeight: "120px",
    overflow: "hidden",
  },
  ".cm-snippet-tooltip-hint": {
    marginTop: "6px",
    fontSize: "11px",
    color: "rgb(113 113 122)",
  },
  ".cm-snippet-tooltip-notfound": {
    color: "rgb(239 68 68)",
    fontStyle: "italic",
  },
});

// Combine into a single extension
export const raycastPlaceholderExtension = [
  raycastPlaceholderPlugin,
  snippetHoverTooltip,
  snippetClickHandler,
  raycastPlaceholderTheme,
];
