import { useState, useMemo, useRef } from "react";
import { X, Copy, Check, Code2, ZoomIn, ZoomOut } from "lucide-react";

interface SvgOptimizerProps {
  isOpen: boolean;
  onClose: () => void;
}

function optimizeSvg(svg: string): string {
  let result = svg;

  // Remove XML declaration
  result = result.replace(/<\?xml[^>]*\?>/g, "");

  // Remove HTML comments
  result = result.replace(/<!--[\s\S]*?-->/g, "");

  // Remove empty groups
  result = result.replace(/<g[^>]*><\/g>/g, "");

  // Remove unnecessary attributes
  result = result.replace(/\s*(version|xml:space|xmlns:xlink|sodipodi:[a-z]+|inkscape:[a-z]+)="[^"]*"/gi, "");

  // Remove metadata and defs that are empty
  result = result.replace(/<metadata>[\s\S]*?<\/metadata>/g, "");
  result = result.replace(/<defs>\s*<\/defs>/g, "");

  // Normalize whitespace between tags
  result = result.replace(/>\s+</g, "><");

  // Trim leading/trailing whitespace
  result = result.trim();

  return result;
}

export function SvgOptimizer({ isOpen, onClose }: SvgOptimizerProps) {
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [zoom, setZoom] = useState(2);
  const previewRef = useRef<HTMLDivElement>(null);

  const output = useMemo(() => input ? optimizeSvg(input) : "", [input]);
  const inputSize = input.length;
  const outputSize = output.length;
  const savings = inputSize ? Math.round((1 - outputSize / inputSize) * 100) : 0;

  const previewSvg = useMemo(() => {
    if (!output) return "";
    // Wrap in SVG if it's just path data
    if (output.trim().startsWith("<svg") || output.trim().startsWith("<path")) {
      return output;
    }
    return output;
  }, [output]);

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/75" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-0 sm:p-3">
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col w-full max-w-4xl h-[80vh] sm:rounded-xl">

          <div className="px-5 pt-5 pb-3 border-b border-zinc-800 bg-zinc-900/10 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20"><Code2 size={18} /></div>
                <div><h3 className="text-sm font-bold text-white">SVG Optimizer</h3><p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">Clean up SVG files</p></div>
              </div>
              <button onClick={onClose} className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-all"><X size={14} /></button>
            </div>
          </div>

          <div className="flex-1 flex flex-col sm:flex-row min-h-0">
            {/* Input */}
            <div className="flex-1 flex flex-col border-r-0 sm:border-r border-zinc-800 min-h-0">
              <div className="px-4 py-2 text-[9px] text-zinc-600 uppercase tracking-wider font-bold bg-zinc-950 shrink-0 flex items-center justify-between">
                <span>Input SVG</span>
                <span className="font-mono">{inputSize} B</span>
              </div>
              <textarea value={input} onChange={e => setInput(e.target.value)}
                placeholder="Paste SVG code here..."
                className="flex-1 bg-zinc-950 p-4 text-xs font-mono text-zinc-400 resize-none outline-none border-none min-h-[120px] sm:min-h-0"
                spellCheck={false} />
            </div>

            {/* Output */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="px-4 py-2 bg-zinc-950 text-[9px] uppercase tracking-wider font-bold shrink-0 flex items-center justify-between border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  <span className="text-emerald-400">Optimized</span>
                  {input && <span className="text-zinc-600 font-mono">{outputSize} B ({savings > 0 ? `-${savings}%` : "0%"})</span>}
                </div>
                <div className="flex items-center gap-2">
                  {previewSvg && (
                    <>
                      <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"><ZoomOut size={12} /></button>
                      <span className="text-[9px] text-zinc-600 font-mono w-6 text-center">{Math.round(zoom * 100)}%</span>
                      <button onClick={() => setZoom(z => Math.min(5, z + 0.25))} className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"><ZoomIn size={12} /></button>
                    </>
                  )}
                  {output && (
                    <button onClick={handleCopy} className="flex items-center gap-1 text-zinc-500 hover:text-zinc-300 transition-colors">
                      {copied ? <><Check size={12} className="text-emerald-400" /> Copied</> : <><Copy size={12} /> Copy</>}
                    </button>
                  )}
                </div>
              </div>

              {/* Preview */}
              {previewSvg && (
                <div className="h-48 sm:h-56 shrink-0 bg-zinc-900/40 border-b border-zinc-800 flex items-center justify-center p-4" ref={previewRef}>
                  <div style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }} className="transition-transform duration-150">
                    <div dangerouslySetInnerHTML={{ __html: previewSvg }} className="[&_svg]:max-h-[180px] [&_svg]:w-auto" />
                  </div>
                </div>
              )}

              {/* Code output */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {output ? (
                  <pre className="p-4 text-xs font-mono text-amber-300 whitespace-pre-wrap">{output}</pre>
                ) : (
                  <div className="flex items-center justify-center h-full text-zinc-700 text-xs">Optimized SVG will appear here</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
