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
  <div className="border-b border-app-border bg-[#050506]">
    <div className="p-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center justify-between border-b border-app-border">
      <span className="flex items-center gap-2">
        {enabled ? <ShieldCheck size={12} /> : <PauseCircle size={12} />}
        Sentinel
      </span>
      <button
        type="button"
        onClick={onToggle}
        className={`px-2 py-1 border text-[9px] uppercase tracking-wider transition-colors ${
          enabled
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            : "border-slate-700 bg-black text-slate-500"
        }`}
      >
        {enabled ? "Armed" : "Off"}
      </button>
    </div>
    <div className="max-h-28 overflow-y-auto p-2 space-y-1">
      {incidents.length === 0 ? (
        <div className="text-[11px] text-slate-600 px-2 py-1.5">No loop interventions</div>
      ) : (
        incidents.slice(0, 4).map(incident => (
          <div key={incident.id} className="border border-red-500/20 bg-red-500/5 px-2 py-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase tracking-wider text-red-300 truncate">{incident.agent}</span>
              <span className="text-[9px] text-slate-600">{incident.at}</span>
            </div>
            <div className="mt-1 flex items-start gap-1.5 text-[11px] text-slate-400 leading-tight">
              <AlertTriangle size={12} className="text-red-300 shrink-0 mt-0.5" />
              <span className="truncate">{incident.command || incident.reason}</span>
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);
