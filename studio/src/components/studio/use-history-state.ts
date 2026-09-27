"use client";

import { useSyncExternalStore } from "react";
import { useScene } from "@pascal-app/core";

type TemporalState = {
  pastStates: readonly unknown[];
  futureStates: readonly unknown[];
};

/**
 * Whether undo / redo would actually do something.
 *
 * `runUndo()` reports `{ kind: 'empty' }` after the fact, which is too late to
 * disable a button with. The depth lives in zundo's temporal store, which is a
 * plain vanilla store rather than a hook, so it is read through
 * `useSyncExternalStore`.
 *
 * Each subscription returns a number, not an object: `getSnapshot` must return
 * a referentially stable value or React re-renders forever.
 */
function useTemporalDepth(select: (state: TemporalState) => number): number {
  return useSyncExternalStore(
    (listener) => useScene.temporal.subscribe(listener),
    () => select(useScene.temporal.getState() as unknown as TemporalState),
    () => 0,
  );
}

export function useCanUndo(): boolean {
  return useTemporalDepth((s) => s.pastStates.length) > 0;
}

export function useCanRedo(): boolean {
  return useTemporalDepth((s) => s.futureStates.length) > 0;
}
