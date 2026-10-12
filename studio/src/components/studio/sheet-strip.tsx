"use client";

import { FileText, LoaderCircle } from "lucide-react";
import { useMemo } from "react";
import { useScene } from "@pascal-app/core";

import { MALDIVES_PROFILE } from "@/lib/sheets/jurisdiction.ts";
import { listProduciblePlanSheets } from "@/lib/sheets/sheet-set.ts";
import type { SceneNodes } from "@/lib/sheets/derive-plan.ts";

import { GlassPanel } from "./glass-panel.tsx";
import type { DrawingSetPreview } from "../use-drawing-set-preview.ts";

const STROKE = 1.75;

function SheetTile({ code, title }: { code: string; title: string }) {
  return (
    <li className="flex w-[112px] shrink-0 flex-col gap-1" aria-label={`${code} ${title}`}>
      <div
        className="flex h-[72px] items-center justify-center rounded-[12px] border"
        style={{
          borderColor: "var(--glass-border)",
          background: "rgba(255,255,255,0.55)",
        }}
      >
        <FileText size={20} strokeWidth={STROKE} aria-hidden="true" style={{ color: "var(--ink-muted)" }} />
      </div>
      <span className="font-mono text-[12px] font-medium leading-4" style={{ color: "var(--ink)" }}>
        {code}
      </span>
      <span className="text-[12px] leading-4" style={{ color: "var(--ink-muted)" }}>
        {title}
      </span>
    </li>
  );
}

export function SheetStrip({ preview }: { preview: DrawingSetPreview }) {
  const nodes = useScene((state) => state.nodes);
  const sheets = useMemo(
    () => listProduciblePlanSheets(nodes as unknown as SceneNodes, MALDIVES_PROFILE),
    [nodes],
  );
  const { status } = preview;

  return (
    <GlassPanel className="pointer-events-auto flex flex-col gap-2 p-3" aria-label="Drawing sheets">
      <div className="flex items-baseline gap-3">
        <h2 className="text-[13px] font-semibold">Drawing sheets (preview)</h2>
        <button
          type="button"
          onClick={() => void preview.generate()}
          disabled={preview.isWorking}
          className="flex items-center gap-1 rounded-[999px] px-2 py-1 text-[12px] transition-colors hover:bg-[var(--glass-hover)]"
          style={{ color: "var(--accent)" }}
        >
          {preview.isWorking ? (
            <LoaderCircle size={12} strokeWidth={STROKE} aria-hidden="true" className="animate-spin" />
          ) : null}
          {preview.isWorking ? "Preparing…" : "Build preview"}
        </button>

        {status.kind === "done" && (
          <span className="text-[12px]" style={{ color: "var(--success)" }} role="status">
            {status.sheets.length} drawing{status.sheets.length === 1 ? "" : "s"} downloaded
          </span>
        )}
        {status.kind === "error" && (
          <span className="text-[12px]" style={{ color: "var(--danger)" }} role="status">
            {status.message}
          </span>
        )}
      </div>

      {sheets.length === 0 ? (
        <p className="text-[13px] leading-snug" style={{ color: "var(--ink-muted)" }}>
          Draw some walls to produce a floor plan.
        </p>
      ) : (
        <ul className="flex items-start gap-3 overflow-x-auto pb-1">
          {sheets.map((sheet) => (
            <SheetTile key={sheet.code} code={sheet.code} title={sheet.title} />
          ))}
        </ul>
      )}
    </GlassPanel>
  );
}
