"use client";

import { Grid3x3, Magnet, Ruler } from "lucide-react";
import {
  useEditor,
  useFloorplanAnnotationVisibility,
  type ViewMode,
} from "@pascal-app/editor";

import { GlassPanel } from "./glass-panel.tsx";

const STROKE = 1.75;

/**
 * The grid step, taken from the store's own setter rather than imported.
 *
 * Pascal does not re-export `GridSnapStep` from the package root, and reaching
 * into its source for a private type would couple us to its file layout. This
 * stays correct automatically if the allowed steps ever change.
 */
type GridSnapStep = Parameters<ReturnType<typeof useEditor.getState>["setGridSnapStep"]>[0];

/** "Both" is Pascal's `split` (DESIGN.md §7.1). */
const VIEW_OPTIONS: readonly { id: ViewMode; label: string }[] = [
  { id: "2d", label: "2D" },
  { id: "3d", label: "3D" },
  { id: "split", label: "Both" },
];

const GRID_STEPS: readonly GridSnapStep[] = [0.5, 0.25, 0.1, 0.05];

function ToggleButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-[16px] transition-colors hover:bg-[var(--glass-hover)]"
      style={{
        background: active ? "var(--accent-soft)" : undefined,
        color: active ? "var(--accent)" : "var(--ink)",
      }}
    >
      {children}
    </button>
  );
}

export function ViewControls() {
  const viewMode = useEditor((s) => s.viewMode);
  const setViewMode = useEditor((s) => s.setViewMode);

  const snappingModeByContext = useEditor((s) => s.snappingModeByContext);
  const setSnappingMode = useEditor((s) => s.setSnappingMode);
  const gridSnapStep = useEditor((s) => s.gridSnapStep);
  const setGridSnapStep = useEditor((s) => s.setGridSnapStep);

  const visibility = useFloorplanAnnotationVisibility((s) => s.visibility);
  const setCategory = useFloorplanAnnotationVisibility((s) => s.setCategory);

  // Snap is presented as one switch, but it is per-context underneath. Walls
  // are the context a customer is actually thinking about when they reach for
  // it, so that is the one this drives.
  const snapOn = snappingModeByContext.wall !== "off";
  const dimensionsOn = visibility.automaticDimensions;

  return (
    <GlassPanel
      className="pointer-events-auto flex items-center gap-1 px-2 py-1.5"
      style={{ borderRadius: "var(--radius-pill)" }}
      role="toolbar"
      aria-label="View and drawing aids"
    >
      <div className="flex items-center gap-0.5" role="group" aria-label="View">
        {VIEW_OPTIONS.map((option) => {
          const active = viewMode === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => setViewMode(option.id)}
              className="rounded-[999px] px-3 py-1.5 text-[13px] transition-colors hover:bg-[var(--glass-hover)]"
              style={{
                background: active ? "var(--accent-soft)" : undefined,
                color: active ? "var(--accent)" : "var(--ink)",
                fontWeight: active ? 600 : 400,
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <span className="mx-1 h-5 w-px" style={{ background: "var(--glass-border)" }} aria-hidden="true" />

      <ToggleButton
        label={snapOn ? "Snap on" : "Snap off"}
        active={snapOn}
        onClick={() => setSnappingMode("wall", snapOn ? "off" : "grid")}
      >
        <Magnet size={16} strokeWidth={STROKE} aria-hidden="true" />
      </ToggleButton>

      <label className="flex items-center gap-1 px-1 text-[13px]" style={{ color: "var(--ink)" }}>
        <Grid3x3 size={16} strokeWidth={STROKE} aria-hidden="true" />
        <span className="sr-only">Grid size</span>
        <select
          value={gridSnapStep}
          onChange={(event) => setGridSnapStep(Number(event.target.value) as GridSnapStep)}
          className="rounded-[16px] bg-transparent py-1 text-[13px]"
          title="Grid size"
        >
          {GRID_STEPS.map((step) => (
            <option key={step} value={step}>
              {step * 1000} mm
            </option>
          ))}
        </select>
      </label>

      <ToggleButton
        label={dimensionsOn ? "Hide dimensions" : "Show dimensions"}
        active={dimensionsOn}
        onClick={() => setCategory("automaticDimensions", !dimensionsOn)}
      >
        <Ruler size={16} strokeWidth={STROKE} aria-hidden="true" />
      </ToggleButton>
    </GlassPanel>
  );
}
