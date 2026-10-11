"use client";

import { useEffect, type RefObject } from "react";

/**
 * Trackpad navigation for the 2D plan.
 *
 * Pascal's floorplan treats every wheel event as zoom and ignores `deltaX`
 * entirely, which is right for a mouse and wrong for a trackpad: a two-finger
 * scroll — the gesture people reach for to move around a drawing — zooms
 * instead, and horizontal scroll does nothing at all.
 *
 * This restores the convention every canvas tool uses (Figma, Miro, Maps):
 *
 *   two-finger scroll  -> pan
 *   pinch              -> zoom
 *   mouse wheel        -> zoom, unchanged
 *
 * The panel exposes no pan API, so panning drives the editor's own gesture:
 * it already pans on a middle-button drag, and its handlers are bound to the
 * `<svg>` and matched by `pointerId`, so a synthetic middle-drag goes down the
 * supported path rather than a private one. The one thing the real gesture has
 * that a synthetic one cannot is a capturable pointer, so `setPointerCapture`
 * is stubbed for the life of the drag — a browser rejects capture of a
 * pointer id it never issued.
 */

/** Synthetic pointer id, chosen not to collide with a real device's. */
const PAN_POINTER_ID = 92_001;
/** Wheel quiet period that ends the drag, ms. A trackpad fires continuously. */
const GESTURE_END_MS = 140;

/**
 * Distinguish a trackpad from a mouse wheel.
 *
 * There is no flag for this, so it is inferred. A mouse wheel arrives as
 * occasional large whole-number steps (commonly ±100 or ±120) with no
 * horizontal component; a trackpad streams small, often fractional deltas and
 * can scroll sideways. Misreading a mouse as a trackpad would cost those users
 * zoom, so the test is deliberately conservative: anything that looks like a
 * clean vertical step is left alone.
 */
function looksLikeTrackpad(event: WheelEvent): boolean {
  if (event.deltaMode !== 0) return false; // line/page mode is never a trackpad
  if (event.deltaX !== 0) return true;
  if (!Number.isInteger(event.deltaY)) return true;
  return Math.abs(event.deltaY) < 40;
}

/**
 * `enabled` is load-bearing, not a convenience: the shell renders a loading
 * state before the canvas exists, so an effect keyed only on the ref object —
 * whose identity never changes — would run once against a null node and never
 * attach. Pass the editor's ready flag so it re-runs when the canvas mounts.
 */
export function useTrackpadNavigation(
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): void {
  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    let svg: SVGSVGElement | null = null;
    let originalCapture: ((pointerId: number) => void) | null = null;
    let anchorX = 0;
    let anchorY = 0;
    let dragX = 0;
    let dragY = 0;
    let endTimer: ReturnType<typeof setTimeout> | null = null;

    const pointerInit = (overrides: PointerEventInit): PointerEventInit => ({
      pointerId: PAN_POINTER_ID,
      pointerType: "mouse",
      isPrimary: true,
      bubbles: true,
      cancelable: true,
      composed: true,
      ...overrides,
    });

    function endDrag() {
      if (!svg) return;
      svg.dispatchEvent(
        new PointerEvent(
          "pointerup",
          pointerInit({ button: 1, buttons: 0, clientX: anchorX + dragX, clientY: anchorY + dragY }),
        ),
      );
      if (originalCapture) svg.setPointerCapture = originalCapture;
      originalCapture = null;
      svg = null;
      endTimer = null;
    }

    function beginDrag(target: SVGSVGElement, clientX: number, clientY: number) {
      svg = target;
      anchorX = clientX;
      anchorY = clientY;
      dragX = 0;
      dragY = 0;
      // Stubbed, not deleted: the panel calls it unconditionally on pointerdown
      // and would throw on a pointer id the browser never issued.
      originalCapture = target.setPointerCapture.bind(target);
      target.setPointerCapture = () => {};
      target.dispatchEvent(
        new PointerEvent("pointerdown", pointerInit({ button: 1, buttons: 4, clientX, clientY })),
      );
    }

    const onWheel = (event: WheelEvent) => {
      // Pinch arrives as ctrl+wheel. That is already zoom, so let it through.
      if (event.ctrlKey || event.metaKey) return;
      if (!looksLikeTrackpad(event)) return;

      const target = (event.target as Element | null)?.closest("svg");
      if (!(target instanceof SVGSVGElement)) return;

      // Claim the event before the panel's own listener turns it into zoom.
      event.preventDefault();
      event.stopPropagation();

      if (!svg) beginDrag(target, event.clientX, event.clientY);

      // Content follows the fingers, so the synthetic pointer moves opposite
      // the scroll delta — the same sense as grabbing the sheet and sliding it.
      dragX -= event.deltaX;
      dragY -= event.deltaY;

      svg?.dispatchEvent(
        new PointerEvent(
          "pointermove",
          pointerInit({ button: -1, buttons: 4, clientX: anchorX + dragX, clientY: anchorY + dragY }),
        ),
      );

      if (endTimer) clearTimeout(endTimer);
      endTimer = setTimeout(endDrag, GESTURE_END_MS);
    };

    container.addEventListener("wheel", onWheel, { capture: true, passive: false });
    return () => {
      container.removeEventListener("wheel", onWheel, { capture: true });
      if (endTimer) clearTimeout(endTimer);
      if (svg && originalCapture) svg.setPointerCapture = originalCapture;
    };
  }, [containerRef, enabled]);
}
