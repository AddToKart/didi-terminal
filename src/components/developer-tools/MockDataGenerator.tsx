import { useState } from "react";
import { X, Copy, Check, Plus, Trash2, Download, Database } from "lucide-react";

interface MockDataGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
}

type FieldType = 
  | "uuid" 
  | "fullName" 
  | "firstName" 
  | "lastName" 
  | "email" 
  | "username" 
  | "number" 
  | "boolean" 
  | "avatarUrl" 
  | "date" 
  | "customArray";

interface SchemaField {
  id: string;
  name: string;
  type: FieldType;
  options?: string; // used for customArray (comma separated)
}

type ExportFormat = "json" | "csv" | "sql";

// --- Generators ---
const generateUUID = () => crypto.randomUUID();
const firstNames = ["James", "John", "Robert", "Michael", "William", "David", "Richard", "Charles", "Joseph", "Thomas", "Mary", "Patricia", "Jennifer", "Linda", "Elizabeth", "Barbara", "Susan", "Jessica", "Sarah", "Karen"];
const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin"];
const domains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "example.com"];

const randomItem = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];
const generateFirstName = () => randomItem(firstNames);
const generateLastName = () => randomItem(lastNames);
const generateEmail = (f: string, l: string) => `${f.toLowerCase()}.${l.toLowerCase()}@${randomItem(domains)}`;
const generateUsername = (f: string, l: string) => `${f.toLowerCase()}_${l.toLowerCase()}${Math.floor(Math.random() * 100)}`;
const generateNumber = () => Math.floor(Math.random() * 1000);
const generateBoolean = () => Math.random() > 0.5;
const generateAvatarUrl = (email: string) => `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`;
const generateDate = () => {
  const start = new Date(2020, 0, 1).getTime();
  const end = new Date().getTime();
  return new Date(start + Math.random() * (end - start)).toISOString();
};

export function MockDataGenerator({ isOpen, onClose }: MockDataGeneratorProps) {
  const [fields, setFields] = useState<SchemaField[]>([
    { id: crypto.randomUUID(), name: "id", type: "uuid" },
    { id: crypto.randomUUID(), name: "name", type: "fullName" },
    { id: crypto.randomUUID(), name: "email", type: "email" },
    { id: crypto.randomUUID(), name: "status", type: "customArray", options: "active,pending,banned" }
  ]);
  
  const [rowCount, setRowCount] = useState<number>(10);
  const [format, setFormat] = useState<ExportFormat>("json");
  const [tableName, setTableName] = useState("users");
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);

  const addField = () => {
    setFields([...fields, { id: crypto.randomUUID(), name: `field${fields.length + 1}`, type: "fullName" }]);
  };

  const removeField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
  };

  const updateField = (id: string, updates: Partial<SchemaField>) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const generateData = () => {
    const data: any[] = [];
    for (let i = 0; i < rowCount; i++) {
      const row: any = {};
      let tempFirst = generateFirstName();
      let tempLast = generateLastName();
      let tempEmail = generateEmail(tempFirst, tempLast);

      fields.forEach(field => {
        switch (field.type) {
          case "uuid": row[field.name] = generateUUID(); break;
          case "firstName": row[field.name] = tempFirst; break;
          case "lastName": row[field.name] = tempLast; break;
          case "fullName": row[field.name] = `${tempFirst} ${tempLast}`; break;
          case "email": row[field.name] = tempEmail; break;
          case "username": row[field.name] = generateUsername(tempFirst, tempLast); break;
          case "number": row[field.name] = generateNumber(); break;
          case "boolean": row[field.name] = generateBoolean(); break;
          case "avatarUrl": row[field.name] = generateAvatarUrl(tempEmail); break;
          case "date": row[field.name] = generateDate(); break;
          case "customArray":
            const opts = field.options?.split(",").map(s => s.trim()).filter(s => s) || ["item1", "item2"];
            row[field.name] = randomItem(opts);
            break;
          default: row[field.name] = "";
        }
      });
      data.push(row);
    }

    if (format === "json") {
      setOutput(JSON.stringify(data, null, 2));
    } else if (format === "csv") {
      if (data.length === 0) {
        setOutput("");
        return;
      }
      const headers = Object.keys(data[0]);
      const csvRows = data.map(row => 
        headers.map(h => {
          let val = row[h];
          if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\\n'))) {
            val = `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        }).join(",")
      );
      setOutput([headers.join(","), ...csvRows].join("\n"));
    } else if (format === "sql") {
      if (data.length === 0) {
        setOutput("");
        return;
      }
      const headers = Object.keys(data[0]);
      const statements = data.map(row => {
        const values = headers.map(h => {
          let val = row[h];
          if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
          if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
          if (val === null || val === undefined) return 'NULL';
          return val;
        });
        return `INSERT INTO ${tableName} (${headers.join(", ")}) VALUES (${values.join(", ")});`;
      });
      setOutput(statements.join("\n"));
    }
  };

  const handleCopy = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm transition-all duration-300">
      <div className="bg-[#0b0b0d]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl w-full max-w-5xl h-full sm:h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 bg-zinc-900/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl text-green-400 border border-green-500/20 shadow-sm">
              <Database size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Mock Data Generator</h3>
              <p className="text-xs text-zinc-500 font-medium">Generate JSON, CSV, or SQL placeholder data</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
          
          {/* Sidebar - Schema Builder */}
          <div className="w-full md:w-1/3 flex flex-col border-r border-white/5 bg-zinc-900/20">
            <div className="p-4 border-b border-white/5 bg-zinc-900/40">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold text-zinc-200">Schema</h4>
                <button
                  onClick={addField}
                  className="flex items-center gap-1 text-[11px] font-medium text-green-400 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 px-2 py-1 rounded transition-colors"
                >
                  <Plus size={12} /> Add Field
                </button>
              </div>

              <div className="space-y-4 mb-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-zinc-400">Rows:</span>
                  <input 
                    type="number" 
                    value={rowCount}
                    onChange={(e) => setRowCount(Math.max(1, Math.min(10000, parseInt(e.target.value) || 10)))}
                    className="bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-zinc-200 w-20 outline-none focus:border-green-500/50 text-right"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-zinc-400">Format:</span>
                  <div className="flex bg-black/40 rounded-lg p-0.5 border border-white/5">
                    {(["json", "csv", "sql"] as const).map(fmt => (
                      <button
                        key={fmt}
                        onClick={() => setFormat(fmt)}
                        className={`px-3 py-1 text-[11px] font-medium rounded-md transition-all uppercase tracking-wider ${format === fmt ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"}`}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                </div>
                {format === "sql" && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-zinc-400">Table:</span>
                    <input 
                      type="text" 
                      value={tableName}
                      onChange={(e) => setTableName(e.target.value)}
                      className="bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-zinc-200 w-32 outline-none focus:border-green-500/50"
                    />
                  </div>
                )}
              </div>

              <button
                onClick={generateData}
                className="w-full flex items-center justify-center gap-2 bg-brand-accent text-zinc-950 font-bold py-2 rounded-lg hover:bg-brand-accent/90 transition-colors shadow-lg shadow-brand-accent/20"
              >
                <Download size={16} /> Generate Data
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {fields.map((field) => (
                <div key={field.id} className="bg-black/40 border border-white/5 p-3 rounded-xl relative group">
                  <button 
                    onClick={() => removeField(field.id)}
                    className="absolute top-2 right-2 text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={12} />
                  </button>
                  <div className="flex items-center gap-2 mb-2 pr-6">
                    <input
                      type="text"
                      value={field.name}
                      onChange={(e) => updateField(field.id, { name: e.target.value })}
                      placeholder="Field name"
                      className="flex-1 bg-transparent border-b border-white/10 px-1 py-0.5 text-xs text-zinc-200 font-mono focus:border-green-500/50 outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={field.type}
                      onChange={(e) => updateField(field.id, { type: e.target.value as FieldType })}
                      className="w-full bg-zinc-900 border border-white/10 rounded px-2 py-1.5 text-[11px] text-zinc-300 outline-none focus:border-green-500/50 appearance-none"
                    >
                      <option value="uuid">UUID</option>
                      <option value="fullName">Full Name</option>
                      <option value="firstName">First Name</option>
                      <option value="lastName">Last Name</option>
                      <option value="email">Email</option>
                      <option value="username">Username</option>
                      <option value="number">Number</option>
                      <option value="boolean">Boolean</option>
                      <option value="avatarUrl">Avatar URL</option>
                      <option value="date">Date</option>
                      <option value="customArray">Custom Array</option>
                    </select>
                  </div>
                  {field.type === "customArray" && (
                    <div className="mt-2">
                      <input
                        type="text"
                        value={field.options || ""}
                        onChange={(e) => updateField(field.id, { options: e.target.value })}
                        placeholder="item1, item2, item3"
                        className="w-full bg-black/40 border border-white/10 px-2 py-1.5 text-[10px] text-zinc-400 rounded outline-none focus:border-green-500/50"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Main Content - Preview */}
          <div className="flex-1 flex flex-col bg-black/40 relative">
            <div className="absolute top-4 right-6 flex items-center gap-2 z-10">
              <button
                onClick={handleCopy}
                disabled={!output}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 rounded-lg text-xs font-medium border border-white/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-md"
              >
                {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-6 custom-scrollbar">
              {output ? (
                <pre className="text-xs font-mono text-zinc-300 leading-relaxed">
                  {output}
                </pre>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-zinc-600">
                  <Database size={48} className="mb-4 opacity-20" strokeWidth={1} />
                  <p className="text-sm font-medium">Define a schema and click Generate</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}