import { useState, useRef, useEffect } from "react";
import { Lock, Fingerprint, RefreshCw, KeyRound, ArrowRight } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface TwoFactorModalProps {
  isOpen: boolean;
  workspaceId: string;
  workspaceName: string;
  onVerify: (success: boolean) => void;
  onCancel: () => void;
}

export function TwoFactorModal({ isOpen, workspaceId, workspaceName, onVerify, onCancel }: TwoFactorModalProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPin("");
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!pin) return;

    setIsVerifying(true);
    setError(null);

    try {
      const isValid = await invoke<boolean>("verify_workspace_pin", { 
        workspaceId, 
        pin 
      });

      if (isValid) {
        onVerify(true);
      } else {
        setError("Incorrect PIN. Please try again.");
        setPin("");
        inputRef.current?.focus();
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsVerifying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/85 animate-in fade-in duration-300" onClick={onCancel} />
      
      <div className="relative w-full max-w-sm bg-[#0a0a0c] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="h-1.5 w-full bg-brand-accent shadow-[0_0_15px_rgba(var(--brand-accent-rgb),0.3)]" />
        
        <div className="p-8 flex flex-col items-center text-center">
          <div className="size-16 rounded-2xl bg-brand-accent/10 flex items-center justify-center mb-6 ring-1 ring-brand-accent/20">
            <Lock className="text-brand-accent" size={32} />
          </div>
          
          <h2 className="text-xl font-bold text-white mb-2">Workspace Locked</h2>
          <p className="text-sm text-zinc-400 mb-8 px-4">
            Enter your PIN to unlock <span className="text-white font-bold">{workspaceName}</span>
          </p>
 
          <form onSubmit={handleSubmit} className="w-full space-y-6">
            <div className="relative group">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-brand-accent transition-colors" size={18} />
              <input
                ref={inputRef}
                type="password"
                placeholder="Enter PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className={`w-full h-12 bg-zinc-950 border pl-12 pr-4 rounded-xl text-center text-lg font-bold tracking-[0.5em] outline-none transition-all ${
                  error ? 'border-red-500/50 text-red-400 focus:ring-1 focus:ring-red-500' : 'border-zinc-800 text-white focus:border-brand-accent focus:ring-1 focus:ring-brand-accent'
                }`}
              />
            </div>
 
            {error && (
              <p className="text-xs text-red-400 bg-red-400/5 py-2 px-3 rounded-lg border border-red-400/10 animate-in shake duration-300">
                {error}
              </p>
            )}
 
            <div className="flex flex-col gap-3 pt-2">
              <button
                type="submit"
                disabled={isVerifying || !pin}
                className="w-full h-11 bg-brand-accent hover:bg-brand-accent/90 disabled:opacity-50 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-accent/20"
              >
                {isVerifying ? (
                  <RefreshCw size={18} className="animate-spin" />
                ) : (
                  <>
                    <ArrowRight size={18} />
                    UNLOCK WORKSPACE
                  </>
                )}
              </button>
              
              <button
                type="button"
                onClick={onCancel}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors font-medium py-2"
              >
                STAY IN CURRENT WORKSPACE
              </button>
            </div>
          </form>
        </div>
        
        <div className="px-8 py-4 bg-[#070709] border-t border-zinc-800 flex items-center justify-center gap-2">
          <Fingerprint size={12} className="text-zinc-600" />
          <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Didi Security Protocol</span>
        </div>
      </div>
    </div>
  );
}
