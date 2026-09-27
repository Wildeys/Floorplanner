"use client";

import { Monitor } from "lucide-react";

import { GlassPanel } from "./glass-panel.tsx";

/**
 * Narrow viewports keep the 3D view but get no drawing tools (DESIGN.md §15).
 *
 * A broken subset of tools would be worse than none, so this states the limit
 * plainly instead of degrading the rail.
 */
export function MobileNotice() {
  return (
    <GlassPanel className="pointer-events-auto mx-4 flex items-center gap-2 px-3 py-2" aria-label="Editing availability">
      <Monitor size={16} strokeWidth={1.75} aria-hidden="true" style={{ color: "var(--ink-muted)" }} />
      <p className="text-[13px]">Editing is on a computer.</p>
    </GlassPanel>
  );
}
