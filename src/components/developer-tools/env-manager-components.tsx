import { Eye, EyeOff, Plus, Trash2, RefreshCw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ── Types ──

export interface EnvConfig {
  path: string;
  name: string;
}

export interface EnvVar {
  key: string;
  value: string;
  isNew?: boolean;
  config: EnvConfig;
}

export interface VaultVar {
  id: string;
  env_key: string;
  env_value: string;
}

// ── LoadingSpinner ──

export function LoadingSpinner({ size = 20 }: { size?: number }) {
  return (
    <div className="h-full flex items-center justify-center">
      <RefreshCw size={size} className="animate-spin text-zinc-500" />
    </div>
  );
}

// ── EmptyState ──

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center opacity-70">
      {icon}
      <p className="text-sm font-bold text-white mb-1">{title}</p>
      <p className="text-xs text-zinc-500 mb-4">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-bold text-white transition-colors animate-all active:scale-95"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// ── VaultVarRow ──

export function VaultVarRow({
  env,
  showValue,
  onUpdate,
  onRemove,
  onToggleVisibility,
}: {
  env: VaultVar;
  showValue: boolean;
  onUpdate: (field: "env_key" | "env_value", value: string) => void;
  onRemove: () => void;
  onToggleVisibility: () => void;
}) {
  return (
    <div className="flex items-center gap-2 group animate-in fade-in slide-in-from-top-2 duration-300">
      <input
        type="text"
        placeholder="SECURE_KEY_NAME"
        value={env.env_key}
        onChange={(e) => onUpdate("env_key", e.target.value)}
        className="flex-[0.4] min-w-0 bg-zinc-950 border border-zinc-800 focus:border-emerald-500/50 rounded-lg px-3 py-2 text-xs font-mono font-bold text-emerald-400 placeholder:text-zinc-700 outline-none transition-all"
      />

      <div className="flex-[0.6] min-w-0 relative flex items-center">
        <input
          type={showValue ? "text" : "password"}
          placeholder="secure value..."
          value={env.env_value}
          onChange={(e) => onUpdate("env_value", e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-500 rounded-lg pl-3 pr-10 py-2 text-xs font-mono text-zinc-300 placeholder:text-zinc-750 outline-none transition-all"
        />
        <button
          onClick={onToggleVisibility}
          className="absolute right-2 p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {showValue ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>

      <div className="w-16 flex items-center justify-end shrink-0">
        <button
          onClick={onRemove}
          className="p-2 text-zinc-650 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors active:scale-95"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// ── EnvVarRow ──

export function EnvVarRow({
  env,
  showValue,
  showConfigPicker,
  configs,
  onUpdate,
  onRemove,
  onToggleVisibility,
}: {
  env: EnvVar;
  showValue: boolean;
  showConfigPicker: boolean;
  configs: EnvConfig[];
  onUpdate: (field: "key" | "value" | "config", value: any) => void;
  onRemove: () => void;
  onToggleVisibility: () => void;
}) {
  return (
    <div className="flex items-center gap-2 group animate-in fade-in slide-in-from-top-2 duration-300">
      {showConfigPicker && (
        <div className="w-28 shrink-0">
          <Select
            value={String(configs.findIndex((c) => c.path === env.config.path))}
            onValueChange={(v) => {
              const cfg = configs[parseInt(v)];
              if (cfg) onUpdate("config", cfg);
            }}
          >
            <SelectTrigger className="w-full bg-zinc-900 border-zinc-800 text-[10px] font-bold text-zinc-400 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4} className="bg-zinc-950 border-zinc-800 z-[200]">
              {configs.map((cfg, idx) => (
                <SelectItem
                  key={idx}
                  value={String(idx)}
                  className="text-[10px] font-medium focus:bg-zinc-900 focus:text-white cursor-pointer"
                >
                  {cfg.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <input
        type="text"
        placeholder="KEY_NAME"
        value={env.key}
        onChange={(e) => onUpdate("key", e.target.value)}
        className="flex-[0.4] min-w-0 bg-zinc-950 border border-zinc-800 focus:border-blue-500/50 rounded-lg px-3 py-2 text-xs font-mono font-bold text-blue-400 placeholder:text-zinc-700 outline-none transition-all"
      />

      <div className="flex-[0.6] min-w-0 relative flex items-center">
        <input
          type={showValue ? "text" : "password"}
          placeholder="value..."
          value={env.value}
          onChange={(e) => onUpdate("value", e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-500 rounded-lg pl-3 pr-10 py-2 text-xs font-mono text-zinc-300 placeholder:text-zinc-750 outline-none transition-all"
        />
        <button
          onClick={onToggleVisibility}
          className="absolute right-2 p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {showValue ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>

      <div className="w-16 flex items-center justify-end shrink-0">
        <button
          onClick={onRemove}
          className="p-2 text-zinc-650 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors active:scale-95"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// ── AddRowButton ──

export function AddRowButton({
  label,
  onClick,
  variant = "env",
}: {
  label: string;
  onClick: () => void;
  variant?: "env" | "vault";
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-center gap-2 py-3 border border-dashed rounded-lg text-xs font-bold transition-all mt-4 group ${
        variant === "vault"
          ? "border-zinc-850 hover:border-emerald-500/30 hover:bg-emerald-500/5 text-zinc-500 hover:text-emerald-400"
          : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50 text-zinc-500 hover:text-zinc-300"
      }`}
    >
      <Plus
        size={14}
        className="group-hover:scale-110 transition-transform"
      />
      {label}
    </button>
  );
}
