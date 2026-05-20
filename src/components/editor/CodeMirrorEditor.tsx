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

// Custom theme tweak to match DidiTerminal zinc palette
const didiEditorTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "13px",
    fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace",
    backgroundColor: "#09090b",
  },
  ".cm-scroller": {
    fontFamily: "inherit",
    lineHeight: "1.7",
    overflow: "auto",
  },
  ".cm-content": {
    caretColor: "#22d3ee",
    padding: "8px 0",
  },
  ".cm-gutters": {
    backgroundColor: "#09090b",
    borderRight: "1px solid #27272a",
    color: "#52525b",
    minWidth: "48px",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "#18181b",
    color: "#a1a1aa",
  },
  ".cm-activeLine": {
    backgroundColor: "#18181b80",
  },
  ".cm-cursor": {
    borderLeftColor: "#22d3ee",
    borderLeftWidth: "2px",
  },
  ".cm-selectionBackground": {
    backgroundColor: "#22d3ee22",
  },
  "&.cm-focused .cm-selectionBackground": {
    backgroundColor: "#22d3ee33",
  },
  ".cm-matchingBracket": {
    backgroundColor: "#22d3ee22",
    outline: "1px solid #22d3ee50",
    borderRadius: "2px",
  },
  ".cm-foldGutter": {
    width: "12px",
  },
  ".cm-tooltip": {
    backgroundColor: "#18181b",
    border: "1px solid #3f3f46",
    borderRadius: "6px",
  },
  ".cm-tooltip-autocomplete": {
    backgroundColor: "#18181b",
    border: "1px solid #3f3f46",
    borderRadius: "8px",
    padding: "4px",
  },
  ".cm-tooltip-autocomplete ul li[aria-selected]": {
    backgroundColor: "#22d3ee20",
    color: "#22d3ee",
    borderRadius: "4px",
  },
  ".cm-searchMatch": {
    backgroundColor: "#eab30840",
    outline: "1px solid #eab30870",
    borderRadius: "2px",
  },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: "#eab30870",
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
      didiEditorTheme,
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
        theme={oneDark}
        extensions={extensions}
        onChange={handleChange}
        basicSetup={false}
        style={{ height: "100%", overflow: "hidden" }}
      />
    </div>
  );
}
