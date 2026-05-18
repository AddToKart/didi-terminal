import { useRef, useLayoutEffect } from "react";

// Spring easing — matches macOS window physics
const FLIP_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";
const FLIP_DURATION_MS = 380;

type LayoutType =
  | "horizontal"
  | "vertical"
  | "grid"
  | "focus"
  | "presentation"
  | "canvas"
  | "waterfall"
  | "dynamic";

interface SnapRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * useFLIPLayout
 *
 * Correct FLIP timing:
 *  - At the END of every effect we save the current rects as `savedRectsRef`
 *    (these become the "First" snapshot for the *next* layout change).
 *  - At the START of every effect, if the layout changed, `savedRectsRef`
 *    contains the pre-change positions → we read the new "Last" positions from
 *    the already-committed DOM, compute the delta, and animate.
 */
export function useFLIPLayout(
  containerRef: React.RefObject<HTMLDivElement | null>,
  agentIds: string[],
  layout: LayoutType
) {
  // Rects saved from the *previous* render — the "First" snapshot.
  const savedRectsRef = useRef<Map<string, SnapRect>>(new Map());
  const prevLayoutRef = useRef<LayoutType>(layout);
  const animationsRef = useRef<Map<string, Animation>>(new Map());

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const layoutChanged = prevLayoutRef.current !== layout;

    // ── FLIP: animate panes from their old positions to their new ones ──────
    if (layoutChanged && savedRectsRef.current.size > 0) {
      // Cancel any animations still running from a previous transition.
      animationsRef.current.forEach((a) => a.cancel());
      animationsRef.current.clear();

      agentIds.forEach((id) => {
        const firstRect = savedRectsRef.current.get(id);
        if (!firstRect) return;

        // "Last" — where the pane is *right now* after the new layout committed.
        const el = container.querySelector(
          `[data-agent-id="${id}"]`
        ) as HTMLElement | null;
        if (!el) return;

        const last = el.getBoundingClientRect();
        if (last.width === 0 || last.height === 0) return; // pane hidden / unmounted

        const dx = firstRect.left - last.left;
        const dy = firstRect.top - last.top;
        const scaleX = firstRect.width / last.width;
        const scaleY = firstRect.height / last.height;

        // Skip if the pane barely moved (avoids trivial 1px jitter).
        const moved =
          Math.abs(dx) > 1 ||
          Math.abs(dy) > 1 ||
          Math.abs(scaleX - 1) > 0.005 ||
          Math.abs(scaleY - 1) > 0.005;
        if (!moved) return;

        // Animate: "Invert" → "Play"
        // Frame 0 puts the element at its old "First" position using a transform.
        // Frame 1 removes the transform — the browser slides it to "Last".
        const anim = el.animate(
          [
            {
              transform: `translate(${dx}px, ${dy}px) scaleX(${scaleX}) scaleY(${scaleY})`,
              transformOrigin: "top left",
            },
            {
              transform: "translate(0,0) scaleX(1) scaleY(1)",
              transformOrigin: "top left",
            },
          ],
          {
            duration: FLIP_DURATION_MS,
            easing: FLIP_EASING,
            // fill:"none" — CSS owns the final layout, not the animation engine.
            fill: "none",
          }
        );

        animationsRef.current.set(id, anim);
        anim.onfinish = () => animationsRef.current.delete(id);
        anim.oncancel = () => animationsRef.current.delete(id);
      });
    }

    prevLayoutRef.current = layout;

    // ── Save current rects as "First" for the NEXT transition ───────────────
    const snapshot = new Map<string, SnapRect>();
    agentIds.forEach((id) => {
      const el = container.querySelector(
        `[data-agent-id="${id}"]`
      ) as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      snapshot.set(id, {
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
      });
    });
    savedRectsRef.current = snapshot;
  }); // No dep-array — runs after EVERY render so savedRectsRef stays fresh.
}
