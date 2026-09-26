"use client";

import { useCallback, useState } from "react";
import { useScene } from "@pascal-app/core";

import { derivePlanLevels, type SceneNodes } from "@/lib/sheets/derive-plan.ts";
import { MALDIVES_PROFILE, type ProjectMetadata } from "@/lib/sheets/jurisdiction.ts";
import { renderSheetSet, type EmittedSheet } from "@/lib/sheets/sheet-set.ts";

/**
 * Until payment and architect release exist (FR-531, FR-532, FR-Q4), every set
 * this produces is a preview and must say so on every page.
 */
const PREVIEW_WATERMARK = "PREVIEW - NOT FOR SUBMISSION";

type Status =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "done"; sheets: readonly EmittedSheet[] }
  | { kind: "error"; message: string };

export default function GenerateDrawingSet({
  project,
}: {
  project: ProjectMetadata;
}) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const generate = useCallback(async () => {
    setStatus({ kind: "working" });
    try {
      // Read the live scene straight from the store — the drawing set is
      // derived from the same node graph the 3D view renders (FR-30, FR-500).
      const nodes = useScene.getState().nodes as unknown as SceneNodes;
      const levels = derivePlanLevels(nodes);

      if (levels.length === 0) {
        setStatus({
          kind: "error",
          message:
            "Nothing to draw yet — add some walls, then generate the set again.",
        });
        return;
      }

      const { pdf, sheets } = await renderSheetSet({
        profile: MALDIVES_PROFILE,
        project,
        levels,
        watermark: PREVIEW_WATERMARK,
      });

      const blob = new Blob([new Uint8Array(pdf)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${project.projectName.replace(/[^\w.-]+/g, "-")}-drawings.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Revoke on the next tick so the download has certainly started.
      setTimeout(() => URL.revokeObjectURL(url), 0);

      setStatus({ kind: "done", sheets });
    } catch (cause: unknown) {
      setStatus({
        kind: "error",
        message: cause instanceof Error ? cause.message : String(cause),
      });
    }
  }, [project]);

  return (
    <div className="pointer-events-auto flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={generate}
        disabled={status.kind === "working"}
        className="rounded-md bg-neutral-900 px-3 py-2 text-xs font-medium text-white shadow-lg disabled:opacity-60 dark:bg-white dark:text-neutral-900"
      >
        {status.kind === "working" ? "Generating…" : "Generate drawing set"}
      </button>

      {status.kind === "done" && (
        <div className="max-w-xs rounded-md bg-white/95 p-3 text-xs shadow-lg dark:bg-neutral-800/95">
          <p className="font-medium">
            {status.sheets.length} sheet{status.sheets.length === 1 ? "" : "s"} downloaded
          </p>
          <ul className="mt-1 space-y-0.5 opacity-80">
            {status.sheets.map((sheet) => (
              <li key={sheet.code}>
                {sheet.code} · {sheet.title} · 1:{sheet.scale}
                {sheet.atDefaultScale ? "" : " (reduced to fit)"}
              </li>
            ))}
          </ul>
          <p className="mt-2 opacity-60">
            Preview only — watermarked until reviewed and released.
          </p>
        </div>
      )}

      {status.kind === "error" && (
        <p className="max-w-xs rounded-md bg-red-50 p-3 text-xs text-red-900 shadow-lg dark:bg-red-950 dark:text-red-100">
          {status.message}
        </p>
      )}
    </div>
  );
}
