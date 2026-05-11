import { useState, useRef, useEffect } from "react";
import { ShieldCheck, Lock, Fingerprint, RefreshCw } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface TwoFactorModalProps {
  isOpen: boolean;
  workspaceId: string;
  workspaceName: string;
  onVerify: (success: boolean) => void;
  onCancel: () => void;
}

export function TwoFactorModal({ isOpen, workspaceId, workspaceName, onVerify, onCancel }: TwoFactorModalProps) {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isOpen) {
      setCode(["", "", "", "", "", ""]);
      setError(null);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [isOpen]);

  const handleInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const fullCode = code.join("");
    if (fullCode.length !== 6) return;

    setIsVerifying(true);
    setError(null);

    try {
      const isValid = await invoke<boolean>("verify_workspace_2fa", { 
        workspaceId, 
        code: fullCode 
      });

      if (isValid) {
        onVerify(true);
      } else {
        setError("Invalid verification code. Please try again.");
        setCode(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    if (code.every(digit => digit !== "")) {
      handleSubmit();
    }
  }, [code]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-md animate-in fade-in duration-300" onClick={onCancel} />
      
      <div className="relative w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header decoration */}
        <div className="h-1.5 w-full bg-gradient-to-r from-brand-accent via-blue-500 to-purple-500" />
        
        <div className="p-8 flex flex-col items-center text-center">
          <div className="size-16 rounded-2xl bg-brand-accent/10 flex items-center justify-center mb-6 ring-1 ring-brand-accent/20">
            <Lock className="text-brand-accent" size={32} />
          </div>
          
          <h2 className="text-xl font-bold text-white mb-2">Two-Factor Authentication</h2>
          <p className="text-sm text-zinc-400 mb-8 px-4">
            The workspace <span className="text-white font-bold">"{workspaceName}"</span> is protected. Enter the code from your authenticator app to unlock.
          </p>

          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-6">
            <div className="flex justify-between gap-2">
              {code.map((digit, i) => (
                <input
                  key={i}
                  ref={el => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  value={digit}
                  onChange={e => handleInput(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  className={`size-12 rounded-xl bg-zinc-950 border text-center text-lg font-bold outline-none transition-all ${
                    error ? 'border-red-500/50 text-red-400 focus:ring-1 focus:ring-red-500' : 'border-white/10 text-white focus:border-brand-accent focus:ring-1 focus:ring-brand-accent'
                  }`}
                />
              ))}
            </div>

            {error && (
              <div className="text-xs text-red-400 bg-red-400/5 py-2 px-3 rounded-lg border border-red-400/10 animate-in fade-in slide-in-from-top-2">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-3 pt-4">
              <button
                type="submit"
                disabled={isVerifying || code.some(d => !d)}
                className="w-full h-11 bg-brand-accent hover:bg-brand-accent/90 disabled:opacity-50 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-accent/20"
              >
                {isVerifying ? (
                  <RefreshCw size={18} className="animate-spin" />
                ) : (
                  <>
                    <ShieldCheck size={18} />
                    UNLOCK WORKSPACE
                  </>
                )}
              </button>
              
              <button
                type="button"
                onClick={onCancel}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors font-medium py-2"
              >
                CANCEL AND STAY HERE
              </button>
            </div>
          </form>
        </div>
        
        {/* Bottom bar */}
        <div className="px-8 py-4 bg-zinc-950/50 border-t border-white/5 flex items-center justify-center gap-2">
          <Fingerprint size={12} className="text-zinc-600" />
          <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Secure Environment Protocol</span>
        </div>
      </div>
    </div>
  );
}
