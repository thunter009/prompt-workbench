import {
  ViewPlugin,
  Decoration,
  DecorationSet,
  EditorView,
  ViewUpdate,
  MatchDecorator,
  WidgetType,
  hoverTooltip,
  type Tooltip,
} from "@codemirror/view";
import { StateField, StateEffect } from "@codemirror/state";
import { RangeSetBuilder } from "@codemirror/state";
import { toast } from "sonner";
import { useSnippetStore } from "@/lib/store";
import {
  parsePlaceholder,
  getPlaceholderPreviewValue,
  isValidPlaceholderType,
} from "@/lib/raycast/placeholder-parser";

// ─── Valid placeholder matching ───────────────────────────────────

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

const placeholderMatcher = new MatchDecorator({
  regexp: PLACEHOLDER_REGEX,
  decoration: (m) => markForType(placeholderCategory(m[1])),
});

export const raycastPlaceholderPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = placeholderMatcher.createDeco(view);
    }

    update(update: ViewUpdate) {
      this.decorations = placeholderMatcher.updateDeco(
        update,
        this.decorations
      );
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

// ─── US-2: Inline value preview widgets (WidgetDecoration) ────────

const PREVIEW_STORAGE_KEY = "pw-inline-previews";

function readPreviewEnabledFromStorage(): boolean {
  if (typeof window === "undefined") return false;
  const storage = window.localStorage as Partial<Storage> | undefined;
  if (!storage || typeof storage.getItem !== "function") return false;
  try {
    return storage.getItem(PREVIEW_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writePreviewEnabledToStorage(enabled: boolean) {
  if (typeof window === "undefined") return;
  const storage = window.localStorage as Partial<Storage> | undefined;
  if (!storage || typeof storage.setItem !== "function") return;
  try {
    storage.setItem(PREVIEW_STORAGE_KEY, String(enabled));
  } catch {
    // Ignore storage errors in test/private contexts.
  }
}

class PreviewWidget extends WidgetType {
  constructor(readonly text: string) {
    super();
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-placeholder-preview";
    span.textContent = ` ${this.text}`;
    return span;
  }

  eq(other: PreviewWidget): boolean {
    return this.text === other.text;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

/** Toggle inline previews on/off */
export const togglePreviewEffect = StateEffect.define<boolean>();

/** State field: whether inline previews are enabled */
export const previewEnabledField = StateField.define<boolean>({
  create() {
    return readPreviewEnabledFromStorage();
  },
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(togglePreviewEffect)) {
        writePreviewEnabledToStorage(e.value);
        return e.value;
      }
    }
    return value;
  },
});

function buildPreviewDecorations(view: EditorView): DecorationSet {
  const enabled = view.state.field(previewEnabledField);
  if (!enabled) return Decoration.none;

  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const re = new RegExp(PLACEHOLDER_REGEX.source, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(line.text)) !== null) {
      const raw = m[0];
      const parsed = parsePlaceholder(raw);
      if (parsed) {
        const preview = getPlaceholderPreviewValue(parsed);
        const pos = line.from + m.index + raw.length;
        builder.add(
          pos,
          pos,
          Decoration.widget({ widget: new PreviewWidget(preview), side: 1 })
        );
      }
    }
  }

  return builder.finish();
}

export const previewWidgetPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildPreviewDecorations(view);
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.state.field(previewEnabledField) !==
          update.startState.field(previewEnabledField)
      ) {
        this.decorations = buildPreviewDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

// ─── US-3: Invalid placeholder error decorations ──────────────────

// Matches brace-wrapped single words that look like placeholder attempts
// but are NOT valid placeholder types. Excludes multi-word/complex JSON content.
const INVALID_PLACEHOLDER_REGEX = /\{([a-z][a-z0-9-]*)\}/g;

// Matches unclosed braces that start a placeholder-like token
const UNCLOSED_PLACEHOLDER_REGEX =
  /\{(clipboard|cursor|date|time|datetime|day|uuid|selection|argument|snippet|[a-z][a-z0-9-]*)(?:\s+[^}]*)?$/gm;

const VALID_TYPES = new Set([
  "clipboard",
  "cursor",
  "date",
  "time",
  "datetime",
  "day",
  "uuid",
  "selection",
  "argument",
  "snippet",
]);

// Known prefixes that suggest the user is trying to type a placeholder
const PLACEHOLDER_PREFIXES = [
  "clip",
  "cur",
  "dat",
  "tim",
  "day",
  "uui",
  "sel",
  "arg",
  "sni",
];

function looksLikePlaceholderAttempt(word: string): boolean {
  if (isValidPlaceholderType(word)) return false;
  // Single lowercase word that starts with a known prefix
  return PLACEHOLDER_PREFIXES.some((p) => word.startsWith(p));
}

const errorMark = Decoration.mark({ class: "cm-placeholder-error" });

function buildErrorDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);

    // Check single-word brace tokens that aren't valid
    const re = new RegExp(INVALID_PLACEHOLDER_REGEX.source, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(line.text)) !== null) {
      const word = m[1];
      if (!VALID_TYPES.has(word) && looksLikePlaceholderAttempt(word)) {
        const from = line.from + m.index;
        const to = from + m[0].length;
        builder.add(from, to, errorMark);
      }
    }

    // Check unclosed placeholders (only at end of line)
    const unclosedRe = new RegExp(UNCLOSED_PLACEHOLDER_REGEX.source, "gm");
    let um: RegExpExecArray | null;
    while ((um = unclosedRe.exec(line.text)) !== null) {
      // Only match if the brace is truly unclosed (no matching } after)
      const afterMatch = line.text.slice(um.index);
      if (!afterMatch.includes("}")) {
        const from = line.from + um.index;
        const to = line.from + line.text.length;
        builder.add(from, to, errorMark);
      }
    }
  }

  return builder.finish();
}

export const errorDecorationPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildErrorDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged) {
        this.decorations = buildErrorDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

// Hover tooltip for error decorations
const errorHoverTooltip = hoverTooltip(
  (view: EditorView, pos: number): Tooltip | null => {
    const line = view.state.doc.lineAt(pos);
    const text = line.text;

    // Check single-word invalid placeholders
    const re = new RegExp(INVALID_PLACEHOLDER_REGEX.source, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const from = line.from + m.index;
      const to = from + m[0].length;
      if (pos >= from && pos <= to) {
        const word = m[1];
        if (!VALID_TYPES.has(word) && looksLikePlaceholderAttempt(word)) {
          return {
            pos: from,
            end: to,
            above: true,
            create() {
              const dom = document.createElement("div");
              dom.className = "cm-placeholder-error-tooltip";
              dom.textContent = `Unknown placeholder type: {${word}}`;
              return { dom };
            },
          };
        }
      }
    }

    // Check unclosed placeholders
    const unclosedRe = new RegExp(UNCLOSED_PLACEHOLDER_REGEX.source, "gm");
    let um: RegExpExecArray | null;
    while ((um = unclosedRe.exec(text)) !== null) {
      const afterMatch = text.slice(um.index);
      if (!afterMatch.includes("}")) {
        const from = line.from + um.index;
        const to = line.from + text.length;
        if (pos >= from && pos <= to) {
          return {
            pos: from,
            end: to,
            above: true,
            create() {
              const dom = document.createElement("div");
              dom.className = "cm-placeholder-error-tooltip";
              dom.textContent = "Malformed placeholder: missing closing }";
              return { dom };
            },
          };
        }
      }
    }

    return null;
  },
  { hoverTime: 300 }
);

// ─── Snippet hover/click (existing) ──────────────────────────────

function snippetRefAt(
  view: EditorView,
  pos: number
): { name: string; from: number; to: number } | null {
  const line = view.state.doc.lineAt(pos);
  const text = line.text;
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

const snippetClickHandler = EditorView.domEventHandlers({
  mousedown(event: MouseEvent, view: EditorView) {
    if (!event.metaKey && !event.ctrlKey) return false;

    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos === null) return false;

    const ref = snippetRefAt(view, pos);
    if (!ref) return false;

    const { snippets, selectSnippet } = useSnippetStore.getState();
    const snippet = snippets.find((s) => s.name === ref.name);
    if (!snippet) {
      event.preventDefault();
      toast.error(`Snippet not found: ${ref.name}`);
      return true;
    }

    event.preventDefault();
    selectSnippet(snippet.id);
    return true;
  },
});

// ─── Theme ────────────────────────────────────────────────────────

export const raycastPlaceholderTheme = EditorView.baseTheme({
  ".cm-raycast-placeholder": {
    borderRadius: "3px",
    padding: "0 2px",
    fontWeight: "500",
  },
  ".cm-raycast-placeholder-clipboard": {
    backgroundColor: "rgba(124, 58, 237, 0.15)",
    color: "rgb(124, 58, 237)",
  },
  ".cm-raycast-placeholder-argument": {
    backgroundColor: "rgba(217, 119, 6, 0.15)",
    color: "rgb(217, 119, 6)",
  },
  ".cm-raycast-placeholder-snippet": {
    backgroundColor: "rgba(13, 148, 136, 0.15)",
    color: "rgb(13, 148, 136)",
  },
  ".cm-raycast-placeholder-date": {
    backgroundColor: "rgba(37, 99, 235, 0.15)",
    color: "rgb(37, 99, 235)",
  },
  ".cm-raycast-placeholder-cursor": {
    backgroundColor: "rgba(225, 29, 72, 0.15)",
    color: "rgb(225, 29, 72)",
  },
  "&.cm-focused .cm-raycast-placeholder": {
    filter: "brightness(1.1)",
  },
  // Inline preview ghost text
  ".cm-placeholder-preview": {
    opacity: "0.4",
    fontStyle: "italic",
    pointerEvents: "none",
    userSelect: "none",
  },
  // Error decoration — red wavy underline
  ".cm-placeholder-error": {
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='3'%3E%3Cpath d='m0 3 l2 -2 l1 0 l2 2' stroke='%23ef4444' fill='none' stroke-width='0.7'/%3E%3C/svg%3E\")",
    backgroundRepeat: "repeat-x",
    backgroundPosition: "bottom",
    paddingBottom: "2px",
  },
  // Error tooltip
  ".cm-placeholder-error-tooltip": {
    padding: "4px 8px",
    backgroundColor: "rgb(24 24 27)",
    border: "1px solid rgb(127 29 29)",
    borderRadius: "4px",
    fontFamily:
      "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace",
    fontSize: "12px",
    color: "rgb(239 68 68)",
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

// ─── Combined extension ───────────────────────────────────────────

export const raycastPlaceholderExtension = [
  raycastPlaceholderPlugin,
  previewEnabledField,
  previewWidgetPlugin,
  errorDecorationPlugin,
  errorHoverTooltip,
  snippetHoverTooltip,
  snippetClickHandler,
  raycastPlaceholderTheme,
];
