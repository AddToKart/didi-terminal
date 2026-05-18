import { useState, useMemo } from "react";
import { X, Copy, Check, ArrowRight, Code2 } from "lucide-react";

interface HtmlToJsxProps {
  isOpen: boolean;
  onClose: () => void;
}

function convertHtmlToJsx(html: string): string {
  let result = html;

  // Self-closing void elements
  const voidElements = ["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"];
  for (const el of voidElements) {
    const regex = new RegExp(`<${el}([^>]*)(?<!/)>`, "gi");
    result = result.replace(regex, (match, attrs) => {
      if (attrs.trim().endsWith("/")) return match;
      return `<${el}${attrs} />`;
    });
  }

  // Attribute mappings
  const attrMap: Record<string, string> = {
    "class": "className",
    "for": "htmlFor",
    "tabindex": "tabIndex",
    "autofocus": "autoFocus",
    "autocomplete": "autoComplete",
    "autoplay": "autoPlay",
    "charset": "charSet",
    "contenteditable": "contentEditable",
    "crossorigin": "crossOrigin",
    "datetime": "dateTime",
    "enctype": "encType",
    "formaction": "formAction",
    "formenctype": "formEncType",
    "formmethod": "formMethod",
    "formnovalidate": "formNoValidate",
    "formtarget": "formTarget",
    "frameborder": "frameBorder",
    "hreflang": "hrefLang",
    "inputmode": "inputMode",
    "ismap": "isMap",
    "itemprop": "itemProp",
    "itemscope": "itemScope",
    "itemtype": "itemType",
    "maxlength": "maxLength",
    "minlength": "minLength",
    "novalidate": "noValidate",
    "playsinline": "playsInline",
    "readonly": "readOnly",
    "srcdoc": "srcDoc",
    "srclang": "srcLang",
    "srcset": "srcSet",
    "usemap": "useMap",
  };

  for (const [htmlAttr, jsxAttr] of Object.entries(attrMap)) {
    const regex = new RegExp(`\\s${htmlAttr}=`, "gi");
    result = result.replace(regex, ` ${jsxAttr}=`);
  }

  // aria-* and data-* attributes are already valid in JSX

  // Style attribute: string to object (basic)
  result = result.replace(/style="([^"]*)"/gi, (_, styleStr) => {
    const props = styleStr.split(";").filter(Boolean).map((s: string) => s.trim());
    const jsxProps = props.map((p: string) => {
      const [key, ...vals] = p.split(":");
      if (!key) return "";
      const val = vals.join(":").trim();
      const camelKey = key.trim().replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
      const numVal = parseFloat(val);
      const isNum = !isNaN(numVal) && val === String(numVal);
      if (camelKey === "background" && val.startsWith("url(")) {
        return `${camelKey}: '${val}'`;
      }
      return `${camelKey}: ${isNum ? numVal : `'${val}'`}`;
    }).filter(Boolean).join(", ");
    return `style={{ ${jsxProps} }}`;
  });

  // SVG attribute mappings
  const svgAttrMap: Record<string, string> = {
    "stroke-width": "strokeWidth",
    "stroke-linecap": "strokeLinecap",
    "stroke-linejoin": "strokeLinejoin",
    "fill-opacity": "fillOpacity",
    "stroke-opacity": "strokeOpacity",
    "stop-color": "stopColor",
    "stop-opacity": "stopOpacity",
    "clip-path": "clipPath",
    "clip-rule": "clipRule",
    "fill-rule": "fillRule",
  };
  for (const [html, jsx] of Object.entries(svgAttrMap)) {
    result = result.replace(new RegExp(`${html}=`, "gi"), `${jsx}=`);
  }

  // Remove HTML comments
  result = result.replace(/<!--[\s\S]*?-->/g, "");

  return result.trim();
}

export function HtmlToJsx({ isOpen, onClose }: HtmlToJsxProps) {
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState(false);

  const output = useMemo(() => input ? convertHtmlToJsx(input) : "", [input]);

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-0 sm:p-3">
        <div className="bg-[#0b0b0d]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col w-full max-w-3xl h-[75vh] sm:rounded-xl">

          <div className="px-5 pt-5 pb-3 border-b border-white/5 bg-zinc-900/40 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/10 rounded-xl text-orange-400 border border-orange-500/20"><Code2 size={18} /></div>
                <div><h3 className="text-sm font-bold text-white">HTML to JSX</h3><p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">Convert HTML to React JSX</p></div>
              </div>
              <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-all"><X size={14} /></button>
            </div>
          </div>

          <div className="flex-1 flex gap-0 sm:gap-3 p-4 min-h-0 flex-col sm:flex-row">
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] text-zinc-600 uppercase tracking-wider font-bold">HTML Input</span>
                <span className="text-[9px] text-zinc-700 font-mono">{input.length} chars</span>
              </div>
              <textarea value={input} onChange={e => setInput(e.target.value)}
                placeholder="Paste HTML here..."
                className="flex-1 bg-black/30 border border-white/5 rounded-xl p-4 text-xs font-mono text-zinc-300 placeholder:text-zinc-700 resize-none outline-none focus:border-orange-500/30 transition-all min-h-[120px] sm:min-h-0"
                spellCheck={false} />
            </div>

            <div className="flex sm:flex-col items-center justify-center py-2 sm:py-0 sm:px-2">
              <ArrowRight size={20} className="text-zinc-700 rotate-90 sm:rotate-0" />
            </div>

            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] text-zinc-600 uppercase tracking-wider font-bold">JSX Output</span>
                {output && (
                  <button onClick={handleCopy} className="flex items-center gap-1 text-[9px] text-zinc-500 hover:text-zinc-300 transition-colors">
                    {copied ? <><Check size={10} className="text-emerald-400" /> Copied</> : <><Copy size={10} /> Copy</>}
                  </button>
                )}
              </div>
              <div className="flex-1 bg-black/30 border border-white/5 rounded-xl p-4 overflow-y-auto custom-scrollbar min-h-[120px] sm:min-h-0">
                {output ? (
                  <pre className="text-xs font-mono text-orange-300 whitespace-pre-wrap">{output}</pre>
                ) : (
                  <div className="flex items-center justify-center h-full text-zinc-700 text-xs">Converted JSX will appear here</div>
                )}
              </div>
            </div>
          </div>

          <div className="px-5 py-2.5 border-t border-white/5 bg-white/[0.02] flex items-center gap-3 text-[9px] text-zinc-600 overflow-x-auto custom-scrollbar shrink-0">
            <span className="font-bold uppercase tracking-wider shrink-0">Transforms:</span>
            <span className="shrink-0">class → className</span>
            <span className="shrink-0">for → htmlFor</span>
            <span className="shrink-0">style → object</span>
            <span className="shrink-0">void elements self-close</span>
            <span className="shrink-0">SVG attrs camelCase</span>
          </div>
        </div>
      </div>
    </div>
  );
}
