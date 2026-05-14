import { useCallback } from "react";

export function useTerminalInput(onInput: (data: string) => void) {
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    // Prevent default browser actions for common terminal shortcuts
    if (e.key === "Tab" || e.key === "Backspace" || e.key === "Enter" || e.key.startsWith("Arrow")) {
      e.preventDefault();
    }
    
    if (e.ctrlKey) {
      if (e.key.length === 1) {
        // Map Ctrl+A..Z to \x01..\x1A
        const charCode = e.key.toLowerCase().charCodeAt(0);
        if (charCode >= 97 && charCode <= 122) {
          e.preventDefault();
          onInput(String.fromCharCode(charCode - 96));
          return;
        }
      }
    }

    switch (e.key) {
      case "Enter":
        onInput("\r");
        break;
      case "Backspace":
        onInput("\x7f");
        break;
      case "Tab":
        onInput("\t");
        break;
      case "Escape":
        onInput("\x1b");
        break;
      case "ArrowUp":
        onInput("\x1b[A");
        break;
      case "ArrowDown":
        onInput("\x1b[B");
        break;
      case "ArrowRight":
        onInput("\x1b[C");
        break;
      case "ArrowLeft":
        onInput("\x1b[D");
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
          onInput(e.key);
        }
        break;
    }
  }, [onInput]);

  return { handleKeyDown };
}
