import { useCallback, useEffect, useMemo, useRef } from "react";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { rust } from "@codemirror/lang-rust";
import { json } from "@codemirror/lang-json";
import { python } from "@codemirror/lang-python";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { autocompletion, closeBrackets } from "@codemirror/autocomplete";
import { bracketMatching, foldGutter, indentOnInput } from "@codemirror/language";
import { highlightActiveLine, lineNumbers } from "@codemirror/view";
import { history } from "@codemirror/commands";
import { search } from "@codemirror/search";
import { EditorView } from "@codemirror/view";

interface CodeMirrorEditorProps {
  tabId: string;
  filePath: string;
  language: string;
  content: string;
  isActive: boolean;
  onContentChange: (tabId: string, value: string) => void;
}

function getLanguageExtension(lang: string) {
  switch (lang) {
    case "javascript":
    case "jsx":
      return javascript({ jsx: true });
    case "typescript":
    case "tsx":
      return javascript({ jsx: true, typescript: true });
    case "css":
    case "scss":
    case "sass":
      return css();
    case "html":
      return html();
    case "rust":
      return rust();
    case "json":
    case "jsonc":
      return json();
    case "python":
      return python();
    case "markdown":
    case "md":
    case "mdx":
      return markdown();
    default:
      return javascript({ jsx: true, typescript: true });
  }
}

// Custom theme — fully overrides oneDark's background with DidiTerminal's zinc-950 palette
const didiEditorTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "13px",
    fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace",
    backgroundColor: "#09090b",
    color: "#d4d4d8",
  },
  ".cm-scroller": {
    fontFamily: "inherit",
    lineHeight: "1.7",
    overflow: "auto",
    backgroundColor: "#09090b",
  },
  ".cm-content": {
    caretColor: "#22d3ee",
    padding: "8px 0",
    backgroundColor: "#09090b",
  },
  ".cm-gutters": {
    backgroundColor: "#09090b",
    borderRight: "1px solid #18181b",
    color: "#3f3f46",
    minWidth: "48px",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    color: "#3f3f46",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "#0f0f11",
    color: "#71717a",
  },
  ".cm-activeLine": {
    backgroundColor: "#0f0f1180",
  },
  ".cm-cursor": {
    borderLeftColor: "#22d3ee",
    borderLeftWidth: "2px",
  },
  ".cm-selectionBackground": {
    backgroundColor: "#22d3ee1a",
  },
  "&.cm-focused .cm-selectionBackground": {
    backgroundColor: "#22d3ee28",
  },
  ".cm-matchingBracket": {
    backgroundColor: "#22d3ee1a",
    outline: "1px solid #22d3ee40",
    borderRadius: "2px",
  },
  ".cm-foldGutter": {
    width: "12px",
  },
  ".cm-foldGutter .cm-gutterElement": {
    color: "#3f3f46",
  },
  ".cm-tooltip": {
    backgroundColor: "#0d0d10",
    border: "1px solid #27272a",
    borderRadius: "6px",
  },
  ".cm-tooltip-autocomplete": {
    backgroundColor: "#0d0d10",
    border: "1px solid #27272a",
    borderRadius: "8px",
    padding: "4px",
  },
  ".cm-tooltip-autocomplete ul li[aria-selected]": {
    backgroundColor: "#22d3ee18",
    color: "#22d3ee",
    borderRadius: "4px",
  },
  ".cm-searchMatch": {
    backgroundColor: "#eab30830",
    outline: "1px solid #eab30860",
    borderRadius: "2px",
  },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: "#eab30860",
  },
  ".cm-panels": {
    backgroundColor: "#09090b",
    borderTop: "1px solid #18181b",
  },
});

export function CodeMirrorEditor({
  tabId,
  language,
  content,
  isActive,
  onContentChange,
}: CodeMirrorEditorProps) {
  const editorRef = useRef<ReactCodeMirrorRef>(null);

  const langExtension = useMemo(() => getLanguageExtension(language), [language]);

  const extensions = useMemo(
    () => [
      oneDark,           // syntax highlight colors from oneDark
      didiEditorTheme,   // our overrides win because they come after
      langExtension,
      history(),
      lineNumbers(),
      foldGutter(),
      bracketMatching(),
      closeBrackets(),
      autocompletion(),
      indentOnInput(),
      highlightActiveLine(),
      search({ top: false }),
      EditorView.lineWrapping,
    ],
    [langExtension]
  );

  const handleChange = useCallback(
    (value: string) => {
      onContentChange(tabId, value);
    },
    [tabId, onContentChange]
  );

  // Focus the editor when this tab becomes active
  useEffect(() => {
    if (isActive && editorRef.current?.view) {
      editorRef.current.view.focus();
    }
  }, [isActive]);

  return (
    <div
      style={{
        display: isActive ? "flex" : "none",
        flexDirection: "column",
        height: "100%",
        width: "100%",
      }}
    >
      <CodeMirror
        ref={editorRef}
        value={content}
        height="100%"
        theme="none"
        extensions={extensions}
        onChange={handleChange}
        basicSetup={false}
        style={{ height: "100%", overflow: "hidden", backgroundColor: "#09090b" }}
      />
    </div>
  );
}
