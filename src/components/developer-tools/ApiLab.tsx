import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { 
  X, 
  Send,
  Zap,
  Clock,
  Globe,
  Trash2,
  Plus,
  Loader2
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

interface Header {
  key: string;
  value: string;
}

interface HttpResponse {
  status: number;
  status_text: string;
  headers: Record<string, string>;
  body: string;
  time_ms: number;
}

interface ApiLabProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ApiLab({ isOpen, onClose }: ApiLabProps) {
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("https://jsonplaceholder.typicode.com/todos/1");
  const [headers, setHeaders] = useState<Header[]>([{ key: "Content-Type", value: "application/json" }]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<HttpResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    setResponse(null);

    const headerMap: Record<string, string> = {};
    headers.forEach(h => {
      if (h.key.trim()) headerMap[h.key.trim()] = h.value.trim();
    });

    try {
      const res = await invoke<HttpResponse>("make_http_request", {
        params: {
          method,
          url,
          headers: headerMap,
          body: ["GET", "HEAD"].includes(method) ? null : (body || null),
        }
      });
      setResponse(res);
    } catch (err) {
      console.error("API Lab Error:", err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    if (status >= 300 && status < 400) return "text-blue-400 bg-blue-500/10 border-blue-500/20";
    if (status >= 400 && status < 500) return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    return "text-red-400 bg-red-500/10 border-red-500/20";
  };

  const formatJson = (text: string) => {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/75 z-[100] animate-in fade-in duration-500" 
        onClick={onClose}
      />

      <div className="fixed inset-0 flex items-center justify-center z-[101] p-4 pointer-events-none">
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden w-full max-w-5xl h-[750px] flex flex-col pointer-events-auto animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
          
          <div className="p-4 border-b border-zinc-800 bg-zinc-900/10 shrink-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                  <Zap size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                    API Lab
                  </h3>
                  <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mt-0.5">REST Client</p>
                </div>
              </div>

              <button 
                onClick={onClose}
                className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-all active:scale-95"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex gap-2">
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="w-[120px] bg-zinc-900 border-zinc-800 text-xs font-bold font-mono shadow-inner h-10">
                  <SelectValue placeholder="Method" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-800 text-white z-[200]">
                  {["GET", "POST", "PUT", "PATCH", "DELETE"].map(m => (
                    <SelectItem key={m} value={m} className="text-xs font-mono font-bold focus:bg-zinc-900 focus:text-white cursor-pointer">
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <div className="relative flex-1">
                <input 
                  type="text"
                  placeholder="https://api.example.com/v1/users"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSend()}
                  className="w-full h-10 bg-zinc-900 border border-zinc-800 rounded-md pl-4 pr-10 text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all shadow-inner"
                />
              </div>

              <Button 
                onClick={handleSend}
                disabled={loading || !url}
                className="h-10 px-6 gap-2 bg-emerald-500 hover:bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:shadow-none"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Send
              </Button>
            </div>
          </div>

          <div className="flex flex-1 min-h-0 divide-x divide-zinc-900">
            {/* Request Pane */}
            <div className="flex-[0.5] flex flex-col min-w-0 bg-black/20">
              <Tabs defaultValue="headers" className="flex-1 flex flex-col min-h-0">
                <div className="px-4 py-2 border-b border-zinc-800/80 shrink-0 bg-zinc-900/10">
                  <TabsList className="bg-zinc-900/80 border border-zinc-800 p-1 h-8">
                    <TabsTrigger value="headers" className="text-[10px] uppercase font-bold tracking-wider data-[state=active]:bg-zinc-800 data-[state=active]:text-white">Headers ({headers.filter(h => h.key).length})</TabsTrigger>
                    <TabsTrigger value="body" className="text-[10px] uppercase font-bold tracking-wider data-[state=active]:bg-zinc-800 data-[state=active]:text-white">Body</TabsTrigger>
                  </TabsList>
                </div>
                
                <TabsContent value="headers" className="flex-1 overflow-y-auto p-4 m-0 custom-scrollbar outline-none data-[state=inactive]:hidden">
                  <div className="space-y-2">
                    {headers.map((header, i) => (
                      <div key={i} className="flex gap-2 items-center group">
                        <input 
                          type="text"
                          placeholder="Key"
                          value={header.key}
                          onChange={e => {
                            const newHeaders = [...headers];
                            newHeaders[i].key = e.target.value;
                            setHeaders(newHeaders);
                          }}
                          className="flex-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-xs font-mono text-blue-400 placeholder:text-zinc-700 outline-none focus:border-blue-500/50 transition-colors"
                        />
                        <input 
                          type="text"
                          placeholder="Value"
                          value={header.value}
                          onChange={e => {
                            const newHeaders = [...headers];
                            newHeaders[i].value = e.target.value;
                            setHeaders(newHeaders);
                          }}
                          className="flex-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-xs font-mono text-zinc-300 placeholder:text-zinc-700 outline-none focus:border-zinc-500 transition-colors"
                        />
                        <button 
                          onClick={() => setHeaders(headers.filter((_, idx) => idx !== i))}
                          className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button 
                      onClick={() => setHeaders([...headers, { key: "", value: "" }])}
                      className="w-full flex items-center justify-center gap-2 py-2 mt-2 border border-dashed border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 rounded-md text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-all"
                    >
                      <Plus size={12} /> Add Header
                    </button>
                  </div>
                </TabsContent>
                
                <TabsContent value="body" className="flex-1 p-0 m-0 outline-none data-[state=inactive]:hidden flex flex-col h-full">
                  <textarea 
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    placeholder="{\n  &quot;key&quot;: &quot;value&quot;\n}"
                    className="flex-1 w-full bg-transparent p-4 text-xs font-mono text-zinc-300 placeholder:text-zinc-700 outline-none resize-none custom-scrollbar leading-relaxed"
                  />
                </TabsContent>
              </Tabs>
            </div>

            {/* Response Pane */}
            <div className="flex-[0.5] flex flex-col min-w-0 bg-[#0a0a0c]">
              {error ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center opacity-80">
                  <Globe size={48} className="text-red-500/50 mb-4" />
                  <p className="text-sm font-bold text-red-400 mb-2">Request Failed</p>
                  <p className="text-xs text-zinc-500 font-mono break-all">{error}</p>
                </div>
              ) : !response ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center opacity-30">
                  <Globe size={48} className="text-zinc-600 mb-4" />
                  <p className="text-sm font-bold text-white">No Response</p>
                  <p className="text-xs text-zinc-500">Hit Send to get a response</p>
                </div>
              ) : (
                <Tabs defaultValue="body" className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800/80 shrink-0 bg-zinc-900/10">
                  <TabsList className="bg-zinc-900/80 border border-zinc-800 p-1 h-8">
                    <TabsTrigger value="body" className="text-[10px] uppercase font-bold tracking-wider data-[state=active]:bg-zinc-800 data-[state=active]:text-white">Body</TabsTrigger>
                    <TabsTrigger value="headers" className="text-[10px] uppercase font-bold tracking-wider data-[state=active]:bg-zinc-800 data-[state=active]:text-white">Headers</TabsTrigger>
                  </TabsList>

                    <div className="flex items-center gap-3">
                      <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-black tracking-widest ${getStatusColor(response.status)}`}>
                        {response.status} {response.status_text}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500">
                        <Clock size={12} />
                        {response.time_ms} ms
                      </div>
                    </div>
                  </div>
                  
                  <TabsContent value="body" className="flex-1 overflow-auto m-0 outline-none data-[state=inactive]:hidden relative">
                    <pre className="p-4 text-xs font-mono text-zinc-300 leading-relaxed">
                      <code>{formatJson(response.body)}</code>
                    </pre>
                  </TabsContent>

                  <TabsContent value="headers" className="flex-1 overflow-auto m-0 outline-none data-[state=inactive]:hidden p-4">
                    <div className="space-y-1">
                      {Object.entries(response.headers).map(([k, v]) => (
                        <div key={k} className="flex gap-4 text-xs font-mono py-1 border-b border-zinc-900 last:border-0">
                          <span className="text-zinc-500 w-1/3 truncate">{k}</span>
                          <span className="text-zinc-300 flex-1 break-all">{v}</span>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}