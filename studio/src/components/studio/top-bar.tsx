"use client";

import {
  ChevronsUpDown,
  CircleUser,
  Cloud,
  CloudOff,
  FileText,
  LoaderCircle,
  Redo2,
  Undo2,
} from "lucide-react";
import { runRedo, runUndo, type SaveStatus } from "@pascal-app/editor";

import { GlassPanel } from "./glass-panel.tsx";
import { useCanRedo, useCanUndo } from "./use-history-state.ts";
import type { DrawingSetPreview } from "../use-drawing-set-preview.ts";

const ICON = 20;
const STROKE = 1.75;

/**
 * Autosave is continuous (FR-1F); this reports state and is never a button.
 * `paused` and `error` both mean the server copy is behind, which to a customer
 * is the same fact — their work is safe locally.
 */
function SaveIndicator({ status }: { status: SaveStatus }) {
  const view = {
    idle: { Icon: Cloud, text: "Saved", tone: "var(--ink-muted)" },
    saved: { Icon: Cloud, text: "Saved", tone: "var(--success)" },
    pending: { Icon: LoaderCircle, text: "Saving…", tone: "var(--ink-muted)" },
    saving: { Icon: LoaderCircle, text: "Saving…", tone: "var(--ink-muted)" },
    paused: { Icon: CloudOff, text: "Saved on this device", tone: "var(--ink-muted)" },
    error: { Icon: CloudOff, text: "Saved on this device", tone: "var(--danger)" },
  }[status];

  const spinning = status === "saving" || status === "pending";

  return (
    <div
      className="flex items-center gap-1.5 px-2 text-[13px]"
      style={{ color: view.tone }}
      role="status"
      aria-live="polite"
    >
      <view.Icon
        size={16}
        strokeWidth={STROKE}
        aria-hidden="true"
        className={spinning ? "animate-spin" : undefined}
      />
      <span>{view.text}</span>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-9 w-9 items-center justify-center rounded-[16px] transition-colors hover:bg-[var(--glass-hover)] disabled:hover:bg-transparent"
      style={{ color: "var(--ink)" }}
    >
      {children}
    </button>
  );
}

export function TopBar({
  projectName,
  saveStatus,
  preview,
}: {
  projectName: string;
  saveStatus: SaveStatus;
  preview: DrawingSetPreview;
}) {
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();

  return (
    <GlassPanel
      as="header"
      aria-label="Studio"
      className="pointer-events-auto mx-4 mt-4 flex h-14 items-center gap-2 px-3"
      style={{ borderRadius: "var(--radius-card)" }}
    >
      <span className="px-1 text-[15px] font-semibold">Floorplanner</span>

      <button
        type="button"
        className="flex items-center gap-1 rounded-[16px] px-2 py-1 text-[13px] transition-colors hover:bg-[var(--glass-hover)] disabled:hover:bg-transparent"
        disabled
        title="Project options — Coming soon"
      >
        <span>{projectName}</span>
        <ChevronsUpDown size={12} strokeWidth={STROKE} aria-hidden="true" />
      </button>

      <div className="mx-1 flex items-center gap-0.5">
        <IconButton label="Undo" onClick={() => runUndo()} disabled={!canUndo}>
          <Undo2 size={ICON} strokeWidth={STROKE} aria-hidden="true" />
        </IconButton>
        <IconButton label="Redo" onClick={() => runRedo()} disabled={!canRedo}>
          <Redo2 size={ICON} strokeWidth={STROKE} aria-hidden="true" />
        </IconButton>
      </div>

      <SaveIndicator status={saveStatus} />

      <div className="flex-1" />

      <button
        type="button"
        onClick={() => void preview.generate()}
        disabled={preview.isWorking}
        title="Build a watermarked preview of your drawings"
        className="flex items-center gap-1.5 rounded-[999px] px-3 py-2 text-[13px] font-medium transition-colors hover:bg-[var(--glass-hover)]"
        style={{ color: "var(--ink)" }}
      >
        {preview.isWorking ? (
          <LoaderCircle size={16} strokeWidth={STROKE} aria-hidden="true" className="animate-spin" />
        ) : (
          <FileText size={16} strokeWidth={STROKE} aria-hidden="true" />
        )}
        {preview.isWorking ? "Preparing drawings…" : "Preview drawings"}
      </button>

      {/*
        Ordering and accounts are not built. They stay visible and disabled so
        the chrome describes the real product rather than implying a flow that
        would fail on click.
      */}
      <button
        type="button"
        disabled
        title="Ordering is not available yet"
        className="rounded-[999px] px-4 py-2 text-[13px] font-medium text-white"
        style={{ background: "var(--accent)" }}
      >
        Order drawings
      </button>

      <IconButton label="Account — not available yet" disabled>
        <CircleUser size={ICON} strokeWidth={STROKE} aria-hidden="true" />
      </IconButton>
    </GlassPanel>
  );
}
