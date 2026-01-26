import {
  ViewPlugin,
  Decoration,
  DecorationSet,
  EditorView,
  ViewUpdate,
  MatchDecorator,
} from "@codemirror/view";

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

// CSS class for placeholder styling
const placeholderMark = Decoration.mark({ class: "cm-raycast-placeholder" });

// Create a match decorator that finds all placeholders
const placeholderMatcher = new MatchDecorator({
  regexp: PLACEHOLDER_REGEX,
  decoration: () => placeholderMark,
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

// Theme for placeholder styling
export const raycastPlaceholderTheme = EditorView.baseTheme({
  ".cm-raycast-placeholder": {
    backgroundColor: "rgba(124, 58, 237, 0.15)",
    borderRadius: "3px",
    padding: "0 2px",
    color: "rgb(124, 58, 237)",
    fontWeight: "500",
  },
  ".cm-raycast-placeholder-name": {
    color: "rgb(124, 58, 237)",
    fontWeight: "600",
  },
  ".cm-raycast-placeholder-attr": {
    color: "rgb(99, 102, 241)",
  },
  "&.cm-focused .cm-raycast-placeholder": {
    backgroundColor: "rgba(124, 58, 237, 0.2)",
  },
});

// Combine into a single extension
export const raycastPlaceholderExtension = [
  raycastPlaceholderPlugin,
  raycastPlaceholderTheme,
];
