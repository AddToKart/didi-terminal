import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Terminal as TerminalIcon, X, Zap, ExternalLink, GripVertical } from "lucide-react";
import type { TerminalLane } from "@/services/terminal-lanes";
import { TerminalLaneStrip } from "./TerminalLaneStrip";
import { TerminalStatsPill } from "./TerminalStatsPill";

interface TerminalInstanceHeaderProps {
  agentName: string;
  agentId: string;
  ptyKey: string;
  isFocused: boolean;
  isReady: boolean;
  sentinelPaused: boolean;
  isPulsing: boolean;
  containerWidth: number;
  lanes: TerminalLane[];
  activeLaneId: string;
  activeLane: TerminalLane;
  editingLaneId: string | null;
  editLaneLabel: string;
  dragAttributes?: any;
  dragListeners?: any;
  onSelectShell: (shellCommand: string) => Promise<void>;
  onSelectLane: (laneId: string) => void;
  onAddLane: (event: React.MouseEvent) => void;
  onCloseLane: (event: React.MouseEvent, laneId: string) => void;
  onStartRenameLane: (lane: TerminalLane) => void;
  onEditLaneLabelChange: (label: string) => void;
  onCommitRenameLane: () => void;
  onCancelRenameLane: () => void;
  onPopOut: () => void;
  onRemovePane?: () => void;
  onSplit?: () => void;
}

export function TerminalInstanceHeader({
  agentName,
  ptyKey,
  isFocused,
  isReady,
  sentinelPaused,
  isPulsing,
  containerWidth,
  lanes,
  activeLaneId,
  activeLane,
  editingLaneId,
  editLaneLabel,
  dragAttributes,
  dragListeners,
  onSelectShell,
  onSelectLane,
  onAddLane,
  onCloseLane,
  onStartRenameLane,
  onEditLaneLabelChange,
  onCommitRenameLane,
  onCancelRenameLane,
  onPopOut,
  onRemovePane,
  onSplit,
}: TerminalInstanceHeaderProps) {
  const [availableShells, setAvailableShells] = useState<{ name: string; command: string; is_wsl: boolean }[]>([]);

  useEffect(() => {
    invoke<{ name: string; command: string; is_wsl: boolean }[]>("get_available_shells")
      .then((shells) => {
        setAvailableShells(shells);
      })
      .catch((e) => {
        console.error("Failed to load available shells:", e);
      });
  }, []);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onSplit) onSplit();
  };

  return (
    <div
      className={`h-8 flex items-center border-b overflow-hidden transition-colors duration-300 ${
        sentinelPaused
          ? "bg-red-500/10 border-red-400/50"
          : isPulsing
          ? "bg-brand-accent/10 border-brand-accent/50"
          : isFocused
          ? "bg-brand-accent/5 border-brand-accent/40"
          : "bg-app-panel border-app-border"
      }`}
      onContextMenu={handleContextMenu}
    >
      <div
        className={`h-full flex items-center gap-2 px-3 shrink-0 select-none ${
          dragListeners ? "cursor-grab active:cursor-grabbing" : ""
        }`}
        {...dragAttributes}
        {...dragListeners}
      >
        {dragListeners && <GripVertical size={12} className="text-slate-600" />}
        <TerminalIcon
          size={12}
          className={
            sentinelPaused
              ? "text-red-300"
              : isPulsing
              ? "text-brand-primary"
              : isFocused
              ? "text-brand-accent"
              : "text-slate-500"
          }
        />
        {containerWidth >= 340 && (
          <span
            className={`text-[11px] font-bold tracking-widest uppercase ${
              sentinelPaused
                ? "text-red-200"
                : isPulsing
                ? "text-brand-primary"
                : isFocused
                ? "text-brand-primary"
                : "text-zinc-200"
            }`}
          >
            {agentName}
          </span>
        )}
        {(isPulsing || sentinelPaused) && <Zap size={12} className="text-brand-warn" />}
      </div>

      <TerminalLaneStrip
        lanes={lanes}
        activeLaneId={activeLaneId}
        editingLaneId={editingLaneId}
        editLaneLabel={editLaneLabel}
        onSelectLane={onSelectLane}
        onAddLane={onAddLane}
        onCloseLane={onCloseLane}
        onStartRenameLane={onStartRenameLane}
        onEditLaneLabelChange={onEditLaneLabelChange}
        onCommitRenameLane={onCommitRenameLane}
        onCancelRenameLane={onCancelRenameLane}
        containerWidth={containerWidth}
      />

      <div className="h-full flex items-center gap-2 px-3 shrink-0">
        {/* Shell Profile Selector Dropdown */}
        {availableShells.length > 0 && containerWidth >= 280 && (
          <div className="relative flex items-center" onClick={(e) => e.stopPropagation()}>
            <select
              value={activeLane.shell || ""}
              onChange={(e) => onSelectShell(e.target.value)}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className={`bg-zinc-950/80 border border-zinc-800/80 hover:border-zinc-700/80 rounded px-1.5 py-0.5 text-zinc-300 font-mono text-[9px] font-bold outline-none cursor-pointer tracking-tight truncate ${
                containerWidth < 360 ? "max-w-[55px] text-[8px]" : "max-w-[110px]"
              }`}
              title="Choose Terminal Shell Profile"
            >
              <option value="" className="bg-zinc-950 text-zinc-400 font-mono text-[9px]">
                Default
              </option>
              {availableShells.map((profile) => (
                <option
                  key={profile.command}
                  value={profile.command}
                  className="bg-zinc-950 text-zinc-300 font-mono text-[9px]"
                >
                  {profile.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* CPU & Memory pill widgets */}
        {containerWidth >= 460 && <TerminalStatsPill ptyKey={ptyKey} />}

        {/* State capsule */}
        <div
          className={`flex items-center gap-1.5 bg-zinc-950/80 border px-2 py-0.5 rounded-md font-mono text-[9px] font-bold ${
            sentinelPaused
              ? "border-red-900/50 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.05)]"
              : isReady
              ? "border-zinc-800/80 text-zinc-400"
              : "border-amber-900/50 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.05)]"
          }`}
        >
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            {sentinelPaused ? (
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></span>
            ) : isReady ? (
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"></span>
            ) : (
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand-warn shadow-[0_0_8px_rgba(245,158,11,0.6)]"></span>
            )}
          </span>
          {containerWidth >= 380 && (
            <span className="tracking-tight uppercase text-[9px]">
              {sentinelPaused ? "PAUSED" : isReady ? "IDLE" : "INIT"}
            </span>
          )}
        </div>

        {/* Button clusters */}
        {onRemovePane && (
          <div className="flex items-center gap-1 ml-1">
            <button
              onClick={onPopOut}
              className="text-zinc-500 hover:text-brand-primary transition-all duration-200 bg-zinc-950/60 hover:bg-brand-accent/10 p-1 rounded border border-zinc-800/80 hover:border-brand-accent/40 active:scale-95 shrink-0"
              title="Pop-out Terminal"
            >
              <ExternalLink size={10} strokeWidth={2.5} />
            </button>
            <button
              onClick={onRemovePane}
              className="text-zinc-500 hover:text-red-400 transition-all duration-200 bg-zinc-950/60 hover:bg-red-500/10 p-1 rounded border border-zinc-800/80 hover:border-red-500/40 active:scale-95 shrink-0"
              title="Terminate Agent"
            >
              <X size={10} strokeWidth={3} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
