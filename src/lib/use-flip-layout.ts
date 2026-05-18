import { useRef, useLayoutEffect } from "react";

// Spring easing — matches macOS window physics
const FLIP_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";
const FLIP_DURATION_MS = 380;

// Entrance animation for newly spawned panes
const ENTER_DURATION_MS = 320;
const ENTER_EASING = "cubic-bezier(0.34, 1.56, 0.64, 1)"; // slight overshoot spring

type LayoutType = string;

interface SnapRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * useFLIPLayout
 *
 * Handles two animation scenarios:
 *
 * 1. Layout switch  — all existing panes FLIP-slide into their new positions.
 * 2. Agent add/remove — new pane plays a scale+fade entrance; existing panes
 *    that shifted positions get FLIP-animated too.
 *
 * Timing contract (no dep-array, runs after every render):
 *   END of render N   → save current rects into savedRectsRef  ("First" for N+1)
 *   START of render N+1 → if layout/agents changed: read DOM = "Last"
 *                        → compute delta from saved "First"
 *                        → animate
 */
export function useFLIPLayout(
  containerRef: React.RefObject<HTMLDivElement | null>,
  agentIds: string[],
  layout: LayoutType
) {
  const savedRectsRef = useRef<Map<string, SnapRect>>(new Map());
  const prevLayoutRef = useRef<LayoutType>(layout);
  const prevAgentIdsRef = useRef<string[]>(agentIds);
  const animationsRef = useRef<Map<string, Animation>>(new Map());

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const layoutChanged = prevLayoutRef.current !== layout;
    const prevIds = prevAgentIdsRef.current;
    const newIds = new Set(agentIds.filter((id) => !prevIds.includes(id)));
    const agentsChanged = newIds.size > 0 || prevIds.length !== agentIds.length;

    if (layoutChanged || agentsChanged) {
      // Cancel any in-flight animations
      animationsRef.current.forEach((a) => a.cancel());
      animationsRef.current.clear();

      agentIds.forEach((id) => {
        const el = container.querySelector(
          `[data-agent-id="${id}"]`
        ) as HTMLElement | null;
        if (!el) return;

        const last = el.getBoundingClientRect();

        // ── ENTRANCE animation for brand-new panes ─────────────────────────
        if (newIds.has(id)) {
          const anim = el.animate(
            [
              {
                opacity: "0",
                transform: "scale(0.82) translateY(8px)",
                transformOrigin: "center center",
              },
              {
                opacity: "1",
                transform: "scale(1) translateY(0)",
                transformOrigin: "center center",
              },
            ],
            {
              duration: ENTER_DURATION_MS,
              easing: ENTER_EASING,
              fill: "none",
            }
          );
          animationsRef.current.set(id, anim);
          anim.onfinish = () => animationsRef.current.delete(id);
          anim.oncancel = () => animationsRef.current.delete(id);
          return;
        }

        // ── FLIP animation for panes that shifted ──────────────────────────
        const firstRect = savedRectsRef.current.get(id);
        if (!firstRect) return;

        const dx = firstRect.left - last.left;
        const dy = firstRect.top - last.top;
        const scaleX = firstRect.width / last.width;
        const scaleY = firstRect.height / last.height;

        const moved =
          Math.abs(dx) > 1 ||
          Math.abs(dy) > 1 ||
          Math.abs(scaleX - 1) > 0.005 ||
          Math.abs(scaleY - 1) > 0.005;
        if (!moved) return;

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
            fill: "none",
          }
        );

        animationsRef.current.set(id, anim);
        anim.onfinish = () => animationsRef.current.delete(id);
        anim.oncancel = () => animationsRef.current.delete(id);
      });
    }

    prevLayoutRef.current = layout;
    prevAgentIdsRef.current = agentIds;

    // Save current rects as "First" for the next transition
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
  }); // No dep-array — must run after every render to keep snapshots fresh.
}
