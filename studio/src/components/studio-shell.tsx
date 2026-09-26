"use client";

import { useEffect, useState } from "react";
import { Editor } from "@pascal-app/editor";
import { loadPlugin } from "@pascal-app/core/registry";
import { builtinPlugin } from "@pascal-app/nodes";

import GenerateDrawingSet from "@/components/generate-drawing-set.tsx";
import type { ProjectMetadata } from "@/lib/sheets/jurisdiction.ts";

/**
 * Placeholder project metadata for the title block.
 *
 * Real projects carry this per record (FR-71); until projects exist this keeps
 * the sheet engine exercised end to end. The four personnel fields are
 * deliberately absent — a generated set carries no name until a human signs it
 * at QA release (FR-520, FR-Q3).
 */
const PROJECT: ProjectMetadata = {
  projectName: "Untitled project",
  client: "-",
  date: new Date().toISOString().slice(0, 10),
  firmName: "-",
  firmDiscipline: "ARCHITECTS, PLANNERS & ENGINEERS.",
};

/**
 * The node registry is global and must be populated before <Editor> mounts —
 * otherwise the editor comes up with no wall/door/window/level kinds and every
 * tool is inert. loadPlugin is idempotent per plugin, but React 18+ strict mode
 * double-invokes effects, so the promise is memoised at module scope and the
 * work happens exactly once per page load.
 */
let pluginLoad: Promise<void> | null = null;
function ensureBuiltinPlugin(): Promise<void> {
  pluginLoad ??= loadPlugin(builtinPlugin);
  return pluginLoad;
}

export default function StudioShell() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    ensureBuiltinPlugin().then(
      () => {
        if (!cancelled) setReady(true);
      },
      (cause: unknown) => {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause : new Error(String(cause)),
          );
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md space-y-2">
          <h1 className="text-lg font-semibold">Editor failed to start</h1>
          <p className="text-sm opacity-70">
            The node registry could not be loaded, so no drawing tools are
            available.
          </p>
          <pre className="overflow-x-auto rounded bg-black/5 p-3 text-xs dark:bg-white/10">
            {error.message}
          </pre>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm opacity-60">Loading studio…</p>
      </div>
    );
  }

  return (
    <Editor
      layoutVersion="v2"
      viewerToolbarRight={<GenerateDrawingSet project={PROJECT} />}
    />
  );
}
