import { useRef, useLayoutEffect } from "react";

// Spring easing — matches macOS window physics
const FLIP_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";
const FLIP_DURATION_MS = 380;

type LayoutType = "horizontal" | "vertical" | "grid" | "focus" | "presentation" | "canvas" | "waterfall" | "dynamic";

interface SnapRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * useFLIPLayout
 *
 * Implements the FLIP (First, Last, Invert, Play) animation pattern for
 * smooth terminal pane layout transitions. When `layoutOrientation` changes,
 * every pane glides organically into its new position using GPU-composited
 * transforms — no layout thrashing, no text reflow.
 *
 * @param containerRef - Ref to the outer container div that wraps all panes.
 * @param agentIds     - Ordered list of agent IDs currently rendered (used to
 *                       identify individual pane nodes via data-agent-id).
 * @param layout       - The active layout orientation string.
 */
export function useFLIPLayout(
  containerRef: React.RefObject<HTMLDivElement | null>,
  agentIds: string[],
  layout: LayoutType
) {
  // Stores the "First" snapshot (bounding rects before layout change).
  const firstRectsRef = useRef<Map<string, SnapRect>>(new Map());
  // Track the previous layout so we only FLIP on real transitions.
  const prevLayoutRef = useRef<LayoutType>(layout);
  // Track running animations so we can cancel them on rapid switches.
  const animationsRef = useRef<Map<string, Animation>>(new Map());

  // ── STEP 1: "First" — snapshot rects BEFORE layout change applies ──────
  // useLayoutEffect fires synchronously after the previous render's DOM
  // commits but before the browser has painted. This gives us "First."
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Only snapshot when a layout change is actually pending.
    if (prevLayoutRef.current === layout) {
      // Layout did not change — but the pane list may have shifted (add/remove).
      // Still take a fresh "First" snapshot for the next transition.
      const snapshot = new Map<string, SnapRect>();
      agentIds.forEach((id) => {
        const el = container.querySelector(`[data-agent-id="${id}"]`) as HTMLElement | null;
        if (el) {
          const r = el.getBoundingClientRect();
          snapshot.set(id, { top: r.top, left: r.left, width: r.width, height: r.height });
        }
      });
      firstRectsRef.current = snapshot;
      return;
    }

    // Cancel any in-flight animations from a previous transition
    animationsRef.current.forEach((anim) => anim.cancel());
    animationsRef.current.clear();

    // Capture "First" — current DOM positions BEFORE React re-renders new layout
    const snapshot = new Map<string, SnapRect>();
    agentIds.forEach((id) => {
      const el = container.querySelector(`[data-agent-id="${id}"]`) as HTMLElement | null;
      if (el) {
        const r = el.getBoundingClientRect();
        snapshot.set(id, { top: r.top, left: r.left, width: r.width, height: r.height });
      }
    });
    firstRectsRef.current = snapshot;
    prevLayoutRef.current = layout;

    // ── STEP 2 & 3: "Last" + "Invert" — happens after React re-renders ──
    // We use a microtask (queueMicrotask → rAF) to read the "Last" positions
    // immediately after React commits the new layout classes, but before paint.
    queueMicrotask(() => {
      requestAnimationFrame(() => {
        const firstRects = firstRectsRef.current;
        if (!firstRects.size) return;
        const newContainer = containerRef.current;
        if (!newContainer) return;

        agentIds.forEach((id) => {
          const first = firstRects.get(id);
          if (!first) return;

          const el = newContainer.querySelector(`[data-agent-id="${id}"]`) as HTMLElement | null;
          if (!el) return;

          // "Last" — where the element actually is now after layout change
          const last = el.getBoundingClientRect();

          const dx = first.left - last.left;
          const dy = first.top - last.top;
          const scaleX = first.width / (last.width || 1);
          const scaleY = first.height / (last.height || 1);

          // Skip if the pane barely moved (< 2px, e.g. same-size grid refresh)
          const isDifferent = Math.abs(dx) > 2 || Math.abs(dy) > 2 || Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01;
          if (!isDifferent) return;

          // "Invert" → "Play": animate from the fake-First transform to identity
          const anim = el.animate(
            [
              // Frame 0: element appears at its old "First" position (the illusion)
              {
                transform: `translate(${dx}px, ${dy}px) scaleX(${scaleX}) scaleY(${scaleY})`,
                transformOrigin: "top left",
              },
              // Frame 1: element rests at its true "Last" position (no transform)
              {
                transform: "translate(0, 0) scaleX(1) scaleY(1)",
                transformOrigin: "top left",
              },
            ],
            {
              duration: FLIP_DURATION_MS,
              easing: FLIP_EASING,
              fill: "none", // Don't hold final state — CSS owns the layout
            }
          );

          animationsRef.current.set(id, anim);

          anim.onfinish = () => {
            animationsRef.current.delete(id);
          };
          anim.oncancel = () => {
            animationsRef.current.delete(id);
          };
        });
      });
    });
  });
}
