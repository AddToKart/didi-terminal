import { useState, useEffect } from "react";

export function useContainerWidth(ref: React.RefObject<HTMLElement | null>) {
  const [containerWidth, setContainerWidth] = useState<number>(500);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
    };
  }, [ref]);

  return containerWidth;
}
