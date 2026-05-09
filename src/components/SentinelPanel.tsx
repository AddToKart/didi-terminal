import { AlertTriangle, PauseCircle, ShieldCheck } from "lucide-react";

export interface SentinelIncident {
  id: string;
  agent: string;
  reason: string;
  command?: string;
  at: string;
}

interface Props {
  enabled: boolean;
  incidents: SentinelIncident[];
  onToggle: () => void;
}

export const SentinelPanel = ({ enabled, incidents, onToggle }: Props) => (
  <div className="shrink-0 flex flex-col min-h-0 border-b border-app-border bg-zinc-900/10">
    <div className="px-4 py-2.5 text-xs font-semibold text-zinc-400 bg-zinc-950/40 flex items-center justify-between border-b border-app-border">
      <span className="flex items-center gap-2">
        {enabled ? <ShieldCheck size={14} /> : <PauseCircle size={14} />}
        Sentinel
      </span>
      <button
        type="button"
        onClick={onToggle}
        className={`px-2 py-0.5 rounded-sm border text-[10px] font-medium transition-colors ${
          enabled
            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
            : "border-zinc-800/50 bg-zinc-900/40 text-zinc-500"
        }`}
      >
        {enabled ? "Armed" : "Off"}
      </button>
    </div>
    <div className="p-3 space-y-2">
      {incidents.length === 0 ? (
        <div className="text-xs text-zinc-500">No loop interventions</div>
      ) : (
        incidents.slice(0, 4).map(incident => (
          <div key={incident.id} className="border border-red-900/30 bg-red-950/20 px-3 py-2 rounded-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-red-400 truncate">{incident.agent}</span>
              <span className="text-[10px] text-zinc-500">{incident.at}</span>
            </div>
            <div className="mt-1.5 flex items-start gap-2 text-xs text-zinc-400 leading-tight">
              <AlertTriangle size={14} className="text-red-500/70 shrink-0 mt-0.5" />
              <span className="truncate">{incident.command || incident.reason}</span>
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);
