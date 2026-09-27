"use client";

import { Upload } from "lucide-react";

import { GlassPanel } from "./glass-panel.tsx";

/**
 * Trace a plan (DESIGN.md §12.2).
 *
 * The underlay flow (FR-40 … FR-43) is not built. The card carries its real
 * explanation and a disabled control rather than an upload button that would
 * accept a file and then do nothing with it.
 */
export function TraceCard() {
  return (
    <GlassPanel className="pointer-events-auto flex h-[148px] w-[280px] flex-col gap-2 p-3" aria-label="Trace a plan">
      <h2 className="text-[13px] font-semibold">Trace a plan</h2>
      <p className="text-[13px] leading-snug" style={{ color: "var(--ink-muted)" }}>
        Upload a floor plan, scale it, then draw over it.
      </p>

      <div className="flex-1" />

      <button
        type="button"
        disabled
        title="Tracing is not available yet"
        className="flex items-center justify-center gap-1.5 rounded-[999px] border px-3 py-2 text-[13px] font-medium"
        style={{ borderColor: "var(--glass-border)", color: "var(--ink)" }}
      >
        <Upload size={16} strokeWidth={1.75} aria-hidden="true" />
        Upload file
      </button>
      <p className="text-[11px]" style={{ color: "var(--ink-muted)" }}>
        Not available yet.
      </p>
    </GlassPanel>
  );
}
