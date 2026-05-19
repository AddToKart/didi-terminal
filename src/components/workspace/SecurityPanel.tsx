import { useState, useEffect } from "react";
import { ShieldCheck, ShieldAlert, X, RefreshCw, Lock, KeyRound, Eye, EyeOff } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface SecurityPanelProps {
  workspaceId: string;
  workspaceName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function SecurityPanel({ workspaceId, workspaceName, isOpen, onClose }: SecurityPanelProps) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      checkStatus();
      setError(null);
      setSuccess(false);
      setPin("");
      setConfirmPin("");
    }
  }, [isOpen, workspaceId]);

  const checkStatus = async () => {
    try {
      const enabled = await invoke<boolean>("is_pin_enabled", { workspaceId });
      setIsEnabled(enabled);
    } catch (err) {
      console.error(err);
    }
  };

  const handleEnable = async () => {
    if (pin.length < 4) {
      setError("PIN must be at least 4 characters");
      return;
    }
    if (pin !== confirmPin) {
      setError("PINs do not match");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await invoke("set_workspace_pin", { workspaceId, pin });
      setSuccess(true);
      setIsEnabled(true);
      setPin("");
      setConfirmPin("");
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!pin) {
      setError("Enter current PIN to disable");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await invoke("disable_workspace_pin", { workspaceId, pin });
      setIsEnabled(false);
      setPin("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/85" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-[#0a0a0c] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-[#0e0e12]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand-accent/10 border border-brand-accent/20">
              <Lock size={18} className="text-brand-accent" />
            </div>
            <div>
              <h2 className="text-md font-bold text-white tracking-tight">Workspace Lock</h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{workspaceName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-400/5 border border-red-400/20 rounded-xl flex items-center gap-3 text-red-400 text-xs animate-in fade-in slide-in-from-top-2">
              <ShieldAlert size={14} className="shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-400/5 border border-emerald-400/20 rounded-xl flex items-center gap-3 text-emerald-400 text-xs animate-in fade-in slide-in-from-top-2">
              <ShieldCheck size={14} className="shrink-0" />
              Security settings updated successfully.
            </div>
          )}

          <div className="p-4 rounded-2xl bg-[#0d0d10] border border-zinc-800/60 flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white">Encryption Status</h3>
              <p className="text-[11px] text-zinc-500">Secure Argon2id Hashing</p>
            </div>
            <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${isEnabled ? 'bg-brand-accent/20 text-brand-accent border border-brand-accent/20' : 'bg-zinc-800 text-zinc-500'}`}>
              {isEnabled ? 'Locked' : 'Unlocked'}
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">
                {isEnabled ? 'Current PIN' : 'New PIN'}
              </label>
              <div className="relative">
                <input 
                  type={showPin ? "text" : "password"}
                  placeholder="Enter PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full bg-[#08080a] border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-accent transition-all font-mono tracking-widest"
                />
                <button 
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {!isEnabled && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Confirm PIN</label>
                <input 
                  type={showPin ? "text" : "password"}
                  placeholder="Repeat PIN"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  className="w-full bg-[#08080a] border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-accent transition-all font-mono tracking-widest"
                />
              </div>
            )}

            <button
              onClick={isEnabled ? handleDisable : handleEnable}
              disabled={isLoading}
              className={`w-full py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg ${
                isEnabled 
                  ? 'bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400' 
                  : 'bg-brand-accent hover:bg-brand-accent/90 text-white shadow-brand-accent/20'
              }`}
            >
              {isLoading ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                isEnabled ? <ShieldAlert size={14} /> : <KeyRound size={14} />
              )}
              {isEnabled ? 'DISABLE LOCK' : 'ENABLE LOCK'}
            </button>
          </div>
        </div>

        <div className="px-6 py-4 bg-[#08080a] border-t border-zinc-800">
          <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest text-center">
            Your PIN is never stored in plain text.
          </p>
        </div>
      </div>
    </div>
  );
}
