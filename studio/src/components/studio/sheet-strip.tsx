"use client";

import { FileText, LoaderCircle } from "lucide-react";

import { GlassPanel } from "./glass-panel.tsx";
import type { DrawingSetPreview } from "../use-drawing-set-preview.ts";

const STROKE = 1.75;

/**
 * The full set a finished project contains (DESIGN.md §12.1), in customer
 * words. Only the floor plans are generated today; the rest are listed so the
 * customer can see what the set will hold, and are visibly empty rather than
 * shown with invented thumbnails.
 */
const SHEETS: readonly { code: string; title: string; generated: boolean }[] = [
  { code: "A.00", title: "Site plan", generated: false },
  { code: "A.01", title: "Ground floor plan", generated: true },
  { code: "A.02", title: "First floor plan", generated: true },
  { code: "A.03", title: "Terrace plan", generated: true },
  { code: "A.04", title: "Roof plan", generated: false },
  { code: "A.05", title: "Elevation 1", generated: false },
  { code: "A.06", title: "Elevation 2", generated: false },
  { code: "A.07", title: "Section", generated: false },
  { code: "A.08", title: "Door schedule", generated: false },
  { code: "A.08a", title: "Window schedule", generated: false },
  { code: "A.09", title: "Stair detail", generated: false },
  { code: "A.10", title: "Ceiling details", generated: false },
  { code: "A.12", title: "Toilet details", generated: false },
  { code: "A.13", title: "AC and flooring", generated: false },
];

function SheetTile({
  code,
  title,
  available,
}: {
  code: string;
  title: string;
  available: boolean;
}) {
  return (
    <li
      className="flex w-[104px] shrink-0 flex-col gap-1.5"
      aria-label={available ? `${code} ${title}` : `${code} ${title} — not generated yet`}
    >
      <div
        className="flex h-[76px] items-center justify-center rounded-[12px] border"
        style={{
          borderColor: "var(--glass-border)",
          borderStyle: available ? "solid" : "dashed",
          background: available ? "rgba(255,255,255,0.55)" : "transparent",
          opacity: available ? 1 : 0.5,
        }}
      >
        {available ? (
          <FileText size={20} strokeWidth={STROKE} aria-hidden="true" style={{ color: "var(--ink-muted)" }} />
        ) : null}
      </div>
      <span
        className="font-mono text-[11px] font-medium"
        style={{ color: available ? "var(--ink)" : "var(--ink-muted)" }}
      >
        {code}
      </span>
      <span className="text-[11px] leading-tight" style={{ color: "var(--ink-muted)" }}>
        {title}
      </span>
    </li>
  );
}

export function SheetStrip({
  preview,
  levelCount,
}: {
  preview: DrawingSetPreview;
  levelCount: number;
}) {
  // Only as many floor plans as there are floors with walls will actually come
  // out of a generate, so the strip marks the rest unavailable rather than
  // promising pages that will not appear.
  const planCodes = new Set(
    SHEETS.filter((s) => s.generated)
      .slice(0, Math.max(levelCount, 0))
      .map((s) => s.code),
  );

  const { status } = preview;

  return (
    <GlassPanel className="pointer-events-auto flex h-[148px] flex-col gap-2 p-3" aria-label="Drawing sheets">
      <div className="flex items-baseline gap-3">
        <h2 className="text-[13px] font-semibold">Drawing sheets (preview)</h2>
        <button
          type="button"
          onClick={() => void preview.generate()}
          disabled={preview.isWorking}
          className="flex items-center gap-1 rounded-[999px] px-2 py-1 text-[11px] transition-colors hover:bg-[var(--glass-hover)]"
          style={{ color: "var(--accent)" }}
        >
          {preview.isWorking ? (
            <LoaderCircle size={12} strokeWidth={STROKE} aria-hidden="true" className="animate-spin" />
          ) : null}
          {preview.isWorking ? "Preparing…" : "Build preview"}
        </button>

        {status.kind === "done" && (
          <span className="text-[11px]" style={{ color: "var(--success)" }} role="status">
            {status.sheets.length} drawing{status.sheets.length === 1 ? "" : "s"} downloaded
          </span>
        )}
        {status.kind === "error" && (
          <span className="text-[11px]" style={{ color: "var(--danger)" }} role="status">
            {status.message}
          </span>
        )}
      </div>

      <ul className="flex flex-1 items-start gap-3 overflow-x-auto pb-1">
        {SHEETS.map((sheet) => (
          <SheetTile
            key={sheet.code}
            code={sheet.code}
            title={sheet.title}
            available={planCodes.has(sheet.code)}
          />
        ))}
      </ul>
    </GlassPanel>
  );
}
