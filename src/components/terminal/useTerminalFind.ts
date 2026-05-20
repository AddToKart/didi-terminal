import { useState, useCallback, useRef } from "react";

export function useTerminalFind() {
  const [terminalFindQuery, setTerminalFindQuery] = useState("");
  const [showTerminalFind, setShowTerminalFind] = useState(false);
  const terminalSearchRef = useRef<{
    findNext: (t: string) => void;
    findPrevious: (t: string) => void;
  } | null>(null);

  const handleTerminalFindChange = useCallback((value: string) => {
    setTerminalFindQuery(value);
    if (value) {
      terminalSearchRef.current?.findNext(value);
    }
  }, []);

  const handleTerminalFindKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) {
          terminalSearchRef.current?.findPrevious(terminalFindQuery);
        } else {
          terminalSearchRef.current?.findNext(terminalFindQuery);
        }
      }
      if (e.key === "Escape") {
        setShowTerminalFind(false);
        setTerminalFindQuery("");
      }
    },
    [terminalFindQuery]
  );

  const handleCloseFind = useCallback(() => {
    setShowTerminalFind(false);
    setTerminalFindQuery("");
  }, []);

  return {
    terminalFindQuery,
    setTerminalFindQuery,
    showTerminalFind,
    setShowTerminalFind,
    terminalSearchRef,
    handleTerminalFindChange,
    handleTerminalFindKeyDown,
    handleCloseFind,
  };
}
