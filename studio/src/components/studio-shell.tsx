"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Editor, useEditor, type SaveStatus } from "@pascal-app/editor";
import { loadPlugin } from "@pascal-app/core/registry";
import { builtinPlugin } from "@pascal-app/nodes";
import { useScene } from "@pascal-app/core";

import { FirstRunHint } from "@/components/studio/first-run-hint.tsx";
import { FurnitureCatalog } from "@/components/studio/furniture-catalog.tsx";
import { MobileNotice } from "@/components/studio/mobile-notice.tsx";
import { SheetStrip } from "@/components/studio/sheet-strip.tsx";
import { ToolRail } from "@/components/studio/tool-rail.tsx";
import { TopBar } from "@/components/studio/top-bar.tsx";
import { TraceCard } from "@/components/studio/trace-card.tsx";
import { ViewControls } from "@/components/studio/view-controls.tsx";
import { useTrackpadNavigation } from "@/components/studio/use-trackpad-navigation.ts";
import { useDrawingSetPreview } from "@/components/use-drawing-set-preview.ts";
import type { ProjectMetadata } from "@/lib/sheets/jurisdiction.ts";

/**
 * Placeholder project metadata for the title block.
 *
 * Real projects carry this per record (FR-71); until projects exist this keeps
 * the drawing generator exercised end to end. The four personnel fields are
 * deliberately absent — a generated set carries no name until a human signs it
 * at review (FR-520, FR-Q3).
 */
const PROJECT: ProjectMetadata = {
  projectName: "Untitled project",
  client: "-",
  date: new Date().toISOString().slice(0, 10),
  firmName: "-",
  firmDiscipline: "ARCHITECTS, PLANNERS & ENGINEERS.",
};

/**
 * Match Pascal's own mobile breakpoint (768px). A wider cutoff hid the
 * customer tool rail while the editor stayed in desktop mode and opened
 * its Plugins column instead.
 */
const EDIT_MIN_WIDTH = 768;
/** At or above this the plan and model share the canvas by default (§4). */
const SPLIT_MIN_WIDTH = 1280;

/**
 * The node registry is global and must be populated before <Editor> mounts —
 * otherwise the editor comes up with no wall/door/window kinds and every tool
 * is inert. loadPlugin is idempotent per plugin, but React strict mode
 * double-invokes effects, so the promise is memoised at module scope and the
 * work happens exactly once per page load.
 */
let pluginLoad: Promise<void> | null = null;
function ensureBuiltinPlugin(): Promise<void> {
  pluginLoad ??= loadPlugin(builtinPlugin);
  return pluginLoad;
}

function useViewportWidth(): number | null {
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    const read = () => setWidth(window.innerWidth);
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);
  return width;
}

/**
 * Put the plan and model side by side on a wide screen — but only once, and
 * only before the customer has expressed a preference. Re-applying it on every
 * resize would silently undo their choice the moment they nudged the window.
 */
function useInitialSplitView(width: number | null) {
  const applied = useRef(false);
  useEffect(() => {
    if (applied.current || width === null) return;
    applied.current = true;
    if (width < SPLIT_MIN_WIDTH) return;
    const editor = useEditor.getState();
    // '3d' is the persisted default; anything else is a real prior choice.
    if (editor.viewMode !== "3d") return;
    editor.setViewMode("split");
  }, [width]);
}

/** How many storeys currently carry geometry, for the sheet strip's tiles. */
function useLevelCount(): number {
  return useScene(
    (state) =>
      Object.values(state.nodes as Record<string, { type?: string }>).filter(
        (node) => node.type === "level",
      ).length,
  );
}

export default function StudioShell() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const canvasRef = useRef<HTMLDivElement | null>(null);
  useTrackpadNavigation(canvasRef, ready);

  const width = useViewportWidth();
  const canEdit = width === null || width >= EDIT_MIN_WIDTH;
  const furnitureOpen = useEditor((s) => s.mode === "build" && s.tool === "item");
  useInitialSplitView(width);

  const project = useMemo(() => PROJECT, []);
  const preview = useDrawingSetPreview(project);
  // Read unconditionally: hooks must not sit inside the edit / view-only branch.
  const levelCount = useLevelCount();

  useEffect(() => {
    let cancelled = false;
    ensureBuiltinPlugin().then(
      () => {
        if (!cancelled) setReady(true);
      },
      (cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause : new Error(String(cause)));
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * `?room=gf-03-4-09` drops the issued fit-out straight onto the canvas as
   * editable nodes, so the model can be checked against the drawing without
   * anyone redrawing it by hand. It replaces the current scene, so it stays
   * behind an explicit flag rather than running on a normal visit.
   */
  useEffect(() => {
    if (!ready) return;
    if (new URLSearchParams(window.location.search).get("room") !== "gf-03-4-09") return;
    void import("@/lib/rooms/seed-editor.ts").then(({ seedRoomGf03409 }) => {
      console.info(`[room] loaded GF-03.4.09 — ${seedRoomGf03409()} nodes`);
    });
  }, [ready]);

  if (error) {
    return (
      <div className="studio-shell relative flex h-full items-center justify-center p-8">
        <div className="studio-backdrop" aria-hidden="true" />
        <div className="relative max-w-md space-y-2">
          <h1 className="text-lg font-semibold">Editor failed to start</h1>
          <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
            The drawing tools could not be loaded.
          </p>
          <pre className="overflow-x-auto rounded bg-black/5 p-3 text-xs">{error.message}</pre>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="studio-shell relative flex h-full items-center justify-center">
        <div className="studio-backdrop" aria-hidden="true" />
        <p className="relative text-sm" style={{ color: "var(--ink-muted)" }}>
          Loading studio…
        </p>
      </div>
    );
  }

  return (
    <div className="studio-shell relative flex h-full w-full flex-col overflow-hidden">
      <div className="studio-backdrop" aria-hidden="true" />

      {/* Chrome sits above the editor; the editor itself keeps its own surface. */}
      <div className="pointer-events-none relative z-20">
        <TopBar projectName={project.projectName} saveStatus={saveStatus} preview={preview} />
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 gap-3 px-4 pt-3">
        {canEdit && (
          <div className="pointer-events-none flex h-full min-h-0 shrink-0 items-stretch">
            <ToolRail />
          </div>
        )}

        <div
          ref={canvasRef}
          className="relative h-full min-h-0 min-w-0 flex-1 overflow-hidden rounded-[20px]"
        >
          <Editor
            layoutVersion="v2"
            onSaveStatusChange={setSaveStatus}
            /*
             * `sidebarTabs` is unset so we do not add more rail tabs. Pascal
             * still injects a Plugins column in edit mode; `.studio-shell`
             * hides that column in CSS. PanelManager stays as the inspector.
             *
             * `stageOverlay` stays unset — filling it hides
             * FloatingLevelSelector, which is the level control.
             */
            viewerToolbarLeft={canEdit ? <ViewControls /> : undefined}
          />

          {canEdit && (
            <div className="pointer-events-none absolute left-1/2 top-24 z-20 -translate-x-1/2">
              <FirstRunHint />
            </div>
          )}
        </div>

        {canEdit && furnitureOpen ? (
          <div className="flex h-full min-h-0 w-[300px] shrink-0">
            <FurnitureCatalog />
          </div>
        ) : null}
      </div>

      <div className="pointer-events-none relative z-20 flex gap-3 p-4">
        {canEdit ? (
          <>
            <div className="min-w-0 flex-1">
              <SheetStrip preview={preview} levelCount={levelCount} />
            </div>
            <TraceCard />
          </>
        ) : (
          <MobileNotice />
        )}
      </div>
    </div>
  );
}
