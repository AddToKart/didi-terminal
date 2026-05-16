import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, X } from "lucide-react";
import { useEffect, useState } from "react";

export function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);
  const appWindow = getCurrentWindow();

  useEffect(() => {
    const updateMaximized = async () => {
      try {
        setIsMaximized(await appWindow.isMaximized());
      } catch (e) {
        console.error("Failed to check maximized state", e);
      }
    };

    updateMaximized();
    const unlistenResized = appWindow.onResized(updateMaximized);
    return () => {
      unlistenResized.then((f) => f());
    };
  }, [appWindow]);

  const handleMinimize = () => appWindow.minimize();
  const handleMaximize = async () => {
    try {
      const maximized = await appWindow.isMaximized();
      if (maximized) {
        await appWindow.unmaximize();
      } else {
        await appWindow.maximize();
      }
    } catch (e) {
      console.error("Failed to toggle maximize", e);
    }
  };
  const handleClose = () => appWindow.close();

  return (
    <div className="flex items-stretch h-full no-drag">
      <button
        onClick={handleMinimize}
        className="h-full w-8 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
      >
        <Minus size={13} strokeWidth={1} />
      </button>
      <button
        onClick={handleMaximize}
        className="h-full w-8 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
      >
        {isMaximized ? (
          <div className="relative size-[9px] mt-[1px]">
            <div className="absolute top-0 right-0 size-[6px] border border-current rounded-[1px]" />
            <div className="absolute bottom-0 left-0 size-[6px] border border-current rounded-[1px] bg-[#09090b]" />
          </div>
        ) : (
          <div className="size-[8px] border border-current rounded-[1px]" />
        )}
      </button>
      <button
        onClick={handleClose}
        className="h-full w-8 flex items-center justify-center text-zinc-400 hover:bg-[#e81123] hover:text-white transition-colors"
      >
        <X size={13} strokeWidth={1} />
      </button>
    </div>
  );
}
