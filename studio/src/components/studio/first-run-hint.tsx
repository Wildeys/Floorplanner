"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { useScene } from "@pascal-app/core";

import { GlassPanel } from "./glass-panel.tsx";

const DISMISS_KEY = "floorplanner:first-run-dismissed";

function alreadyDismissed(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(DISMISS_KEY) === "1";
}

function sceneHasWalls(): boolean {
  return Object.values(
    useScene.getState().nodes as Record<string, { type?: string }>,
  ).some((node) => node.type === "wall");
}

/**
 * Shown on an empty building, gone for good once they start (DESIGN.md §7.4).
 *
 * Visibility is one piece of sticky state rather than a live read of the wall
 * count: keying off the count would bring the hint back when someone deletes
 * their last wall, which reads as a bug rather than as help. The first wall
 * retires it permanently, here and in storage.
 */
export function FirstRunHint() {
  // Resolved at initialisation. Doing this in an effect would setState on the
  // first commit and cascade a second render.
  const [hidden, setHidden] = useState(() => alreadyDismissed() || sceneHasWalls());

  const dismiss = useCallback(() => {
    setHidden(true);
    window.localStorage.setItem(DISMISS_KEY, "1");
  }, []);

  // Subscribing to an external store and setting state from its callback is
  // what effects are for — unlike setting state in the effect body.
  useEffect(() => {
    if (hidden) return;
    const unsubscribe = useScene.subscribe(() => {
      if (!sceneHasWalls()) return;
      window.localStorage.setItem(DISMISS_KEY, "1");
      setHidden(true);
    });
    return unsubscribe;
  }, [hidden]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismiss]);

  if (hidden) return null;

  return (
    <GlassPanel className="pointer-events-auto w-[320px] p-4" aria-label="Getting started">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <p className="text-[13px] font-semibold">Start with a wall.</p>
          <p className="mt-1 text-[13px] leading-snug" style={{ color: "var(--ink-muted)" }}>
            Choose <strong>Walls</strong> on the left and click a path on the plan.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          title="Dismiss"
          className="rounded-[16px] p-1 transition-colors hover:bg-[var(--glass-hover)]"
        >
          <X size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </GlassPanel>
  );
}
