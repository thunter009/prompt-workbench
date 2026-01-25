"use client";

import { useEffect, useRef, useState } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, drawSelection } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { raycastPlaceholderExtension } from "./raycast-placeholder-language";

const INITIAL_DOC = `# Welcome to Prompt Workbench

This editor supports **Raycast placeholder syntax**.

Try these placeholders:
- {clipboard} - pastes clipboard content
- {cursor} - positions cursor after paste
- {date} - current date
- {date format="yyyy-MM-dd"} - formatted date
- {time} - current time
- {datetime} - combined date/time
- {day} - day of week
- {uuid} - random UUID
- {selection} - selected text
- {argument name="topic"} - user input
- {snippet name="greeting"} - reference another snippet

Example prompt:
---
Hey {argument name="name"},

Today is {date format="EEEE, MMMM d"}.

{clipboard}

Best regards
`;

export function PromptEditor() {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [charCount, setCharCount] = useState(0);

  useEffect(() => {
    if (!editorRef.current || viewRef.current) return;

    const state = EditorState.create({
      doc: INITIAL_DOC,
      extensions: [
        lineNumbers(),
        drawSelection(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        markdown(),
        raycastPlaceholderExtension,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            setCharCount(update.state.doc.length);
          }
        }),
        EditorView.theme({
          "&": {
            height: "400px",
            fontSize: "14px",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
          },
          ".cm-content": {
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
            padding: "12px",
          },
          ".cm-gutters": {
            backgroundColor: "#f9fafb",
            borderRight: "1px solid #e5e7eb",
            borderRadius: "8px 0 0 8px",
          },
          ".cm-scroller": {
            overflow: "auto",
          },
          "&.cm-focused": {
            outline: "2px solid rgb(124, 58, 237)",
            outlineOffset: "-1px",
          },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;
    setCharCount(state.doc.length);

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  const isOverLimit = charCount > 65536;

  return (
    <div className="space-y-2">
      <div ref={editorRef} />
      <div className="flex justify-between text-sm text-gray-500">
        <span>
          Raycast placeholders are <span className="text-violet-600 font-medium">highlighted</span>
        </span>
        <span className={isOverLimit ? "text-red-500 font-medium" : ""}>
          {charCount.toLocaleString()} / 65,536 characters
          {isOverLimit && " (over limit!)"}
        </span>
      </div>
    </div>
  );
}
