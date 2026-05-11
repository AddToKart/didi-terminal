import { useState, useEffect } from "react";
import { ShieldCheck, ShieldAlert, X, Copy, Check, RefreshCw, Smartphone, Shield, Lock } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface SecurityPanelProps {
  workspaceId: string;
  workspaceName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function SecurityPanel({ workspaceId, workspaceName, isOpen, onClose }: SecurityPanelProps) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [setupData, setSetupData] = useState<{ secret: string; qr_code: string } | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      checkStatus();
    }
  }, [isOpen, workspaceId]);

  const checkStatus = async () => {
    try {
      const enabled = await invoke<boolean>("is_2fa_enabled", { workspaceId });
      setIsEnabled(enabled);
    } catch (err) {
      console.error(err);
    }
  };

  const startSetup = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await invoke<{ secret: string; qr_code: string }>("generate_2fa_setup", { workspaceName });
      setSetupData(data);
      setIsSettingUp(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAndEnable = async () => {
    if (!setupData) return;
    setIsLoading(true);
    setError(null);
    try {
      await invoke("verify_and_enable_2fa", {
        workspaceId,
        secret: setupData.secret,
        code: verificationCode
      });
      setIsEnabled(true);
      setIsSettingUp(false);
      setSetupData(null);
      setVerificationCode("");
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!verificationCode) {
        setError("Please enter your current code to disable 2FA");
        return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await invoke("disable_workspace_2fa", { workspaceId, code: verificationCode });
      setIsEnabled(false);
      setVerificationCode("");
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative w-full max-w-lg bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <Lock size={18} className="text-emerald-500" />
            </div>
            <div>
              <h2 className="text-md font-bold text-white tracking-tight">Security Settings</h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{workspaceName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-6 p-3 bg-red-400/5 border border-red-400/20 rounded-xl flex items-center gap-3 text-red-400 text-xs">
              <ShieldAlert size={14} className="shrink-0" />
              {error}
            </div>
          )}

          {!isSettingUp ? (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white">Two-Factor Authentication (TOTP)</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed max-w-[280px]">
                    Require a verification code from your mobile device every time you switch to this workspace. Recommended for production environments.
                  </p>
                </div>
                <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${isEnabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-500'}`}>
                  {isEnabled ? 'Enabled' : 'Disabled'}
                </div>
              </div>

              {isEnabled ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Enter Code to Disable</label>
                    <input 
                      type="text"
                      placeholder="6-digit code"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500/50 transition-all text-center tracking-[1em] font-mono"
                      maxLength={6}
                    />
                  </div>
                  <button
                    onClick={handleDisable}
                    disabled={isLoading}
                    className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                  >
                    {isLoading ? <RefreshCw size={14} className="animate-spin" /> : <ShieldAlert size={14} />}
                    DISABLE TWO-FACTOR
                  </button>
                </div>
              ) : (
                <button
                  onClick={startSetup}
                  disabled={isLoading}
                  className="w-full py-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-500 rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-500/5 flex items-center justify-center gap-2"
                >
                  {isLoading ? <RefreshCw size={16} className="animate-spin" /> : <Smartphone size={16} />}
                  SETUP AUTHENTICATOR
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <div className="text-center space-y-2">
                <h3 className="text-sm font-bold text-white">Scan QR Code</h3>
                <p className="text-xs text-zinc-500">Scan this code with Google Authenticator, Authy, or any TOTP app.</p>
              </div>

              <div className="flex justify-center">
                <div className="p-4 bg-white rounded-2xl shadow-2xl">
                  <img src={setupData?.qr_code} alt="2FA QR Code" className="size-48" />
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Or enter secret manually</label>
                  <div className="flex gap-2">
                    <code className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-xs text-brand-primary font-mono select-all flex items-center justify-center">
                      {setupData?.secret}
                    </code>
                    <button 
                        onClick={() => {
                            navigator.clipboard.writeText(setupData?.secret || "");
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                        }}
                        className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors"
                    >
                        {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} className="text-zinc-400" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Verify Verification Code</label>
                  <input 
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-accent transition-all text-center tracking-[1em] font-mono"
                    maxLength={6}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => { setIsSettingUp(false); setSetupData(null); }}
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 rounded-xl text-xs font-bold transition-all"
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={handleVerifyAndEnable}
                    disabled={isLoading || verificationCode.length !== 6}
                    className="flex-[2] py-3 bg-brand-accent hover:bg-brand-accent/90 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-accent/20"
                  >
                    {isLoading ? <RefreshCw size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                    VERIFY AND ENABLE
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-zinc-950/50 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield size={12} className="text-zinc-600" />
            <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest italic">Encrypted Local Vault</span>
          </div>
        </div>
      </div>
    </div>
  );
}
