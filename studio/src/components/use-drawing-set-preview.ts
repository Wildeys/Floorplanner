"use client";

import { useCallback, useState } from "react";
import { useScene } from "@pascal-app/core";

import { derivePlanLevels, type SceneNodes } from "@/lib/sheets/derive-plan.ts";
import { MALDIVES_PROFILE, type ProjectMetadata } from "@/lib/sheets/jurisdiction.ts";
import { renderSheetSet, type EmittedSheet } from "@/lib/sheets/sheet-set.ts";

/**
 * Until payment and architect release exist (FR-531, FR-532, FR-Q4), every set
 * produced here is a preview and says so on every page. The watermark is not a
 * placeholder to be removed later by the client — a released set is a separate,
 * server-side path that does not exist yet.
 */
const PREVIEW_WATERMARK = "PREVIEW - NOT FOR SUBMISSION";

export type PreviewStatus =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "done"; sheets: readonly EmittedSheet[] }
  | { kind: "error"; message: string };

export type DrawingSetPreview = {
  readonly status: PreviewStatus;
  readonly isWorking: boolean;
  readonly generate: () => Promise<void>;
  readonly dismiss: () => void;
};

/**
 * Owns the whole watermarked-preview flow so more than one piece of chrome can
 * trigger it without duplicating controls or state. The top bar starts it; the
 * sheet strip reads the same status.
 */
export function useDrawingSetPreview(project: ProjectMetadata): DrawingSetPreview {
  const [status, setStatus] = useState<PreviewStatus>({ kind: "idle" });

  const generate = useCallback(async () => {
    setStatus({ kind: "working" });
    try {
      // Read the live model straight from the store, so the drawings come from
      // the same data the 2D and 3D views render (FR-30, FR-500).
      const nodes = useScene.getState().nodes as unknown as SceneNodes;
      const levels = derivePlanLevels(nodes);

      if (levels.length === 0) {
        setStatus({
          kind: "error",
          message: "Nothing to draw yet — add some walls, then try again.",
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
      link.download = `${project.projectName.replace(/[^\w.-]+/g, "-")}-drawings-preview.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Revoked on the next tick so the download has certainly started.
      setTimeout(() => URL.revokeObjectURL(url), 0);

      setStatus({ kind: "done", sheets });
    } catch (cause: unknown) {
      setStatus({
        kind: "error",
        message: cause instanceof Error ? cause.message : String(cause),
      });
    }
  }, [project]);

  const dismiss = useCallback(() => setStatus({ kind: "idle" }), []);

  return { status, isWorking: status.kind === "working", generate, dismiss };
}
