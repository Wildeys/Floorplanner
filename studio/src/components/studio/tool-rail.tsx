"use client";

import {
  AppWindow,
  ArrowUpFromLine,
  BrickWall,
  CircleHelp,
  DoorOpen,
  FolderOpen,
  MousePointer2,
  Pentagon,
  Ruler,
  Sofa,
  Type as TypeIcon,
  type LucideIcon,
} from "lucide-react";
import { useEditor, type StructureTool } from "@pascal-app/editor";

import { GlassPanel } from "./glass-panel.tsx";

const ICON_SIZE = 20;
const STROKE = 1.75;

type RailItem = {
  readonly id: string;
  readonly label: string;
  readonly icon: LucideIcon;
  /** The Pascal build tool this activates, or "select" for the pointer. */
  readonly tool: StructureTool | "select" | null;
  /** How-to line shown in the tooltip for the drawing tools (DESIGN.md §6.3). */
  readonly hint?: string;
};

/**
 * Tools that are not built yet stay visible and disabled rather than hidden:
 * the rail is the product map, so removing them would misrepresent the product
 * (DESIGN.md §6.3).
 */
const DRAWING_TOOLS: readonly RailItem[] = [
  {
    id: "select",
    label: "Select",
    icon: MousePointer2,
    tool: "select",
    hint: "Click to pick. Drag to move.",
  },
  {
    id: "wall",
    label: "Walls",
    icon: BrickWall,
    tool: "wall",
    hint: "Click to start. Click to add a corner. Enter to finish.",
  },
  { id: "door", label: "Doors", icon: DoorOpen, tool: "door", hint: "Click a wall to place a door." },
  {
    id: "window",
    label: "Windows",
    icon: AppWindow,
    tool: "window",
    hint: "Click a wall to place a window.",
  },
  { id: "room", label: "Rooms", icon: Pentagon, tool: "room", hint: "Name an enclosed space." },
  { id: "item", label: "Furniture", icon: Sofa, tool: "item", hint: "Drag furniture onto the plan." },
  { id: "stair", label: "Stairs", icon: ArrowUpFromLine, tool: "stair", hint: "Place a stair." },
  { id: "notes", label: "Notes", icon: TypeIcon, tool: null },
  { id: "dimensions", label: "Dimensions", icon: Ruler, tool: null },
];

const SECONDARY_ITEMS: readonly RailItem[] = [
  { id: "projects", label: "Projects", icon: FolderOpen, tool: null },
  { id: "help", label: "Help", icon: CircleHelp, tool: null },
];

function ToolButton({ item, selected, onSelect }: {
  item: RailItem;
  selected: boolean;
  onSelect: (item: RailItem) => void;
}) {
  const Icon = item.icon;
  const available = item.tool !== null;
  const title = available
    ? item.hint
      ? `${item.label} — ${item.hint}`
      : item.label
    : `${item.label} — Coming soon`;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      aria-label={item.label}
      disabled={!available}
      title={title}
      onClick={() => onSelect(item)}
      className="tool-button"
    >
      <Icon size={ICON_SIZE} strokeWidth={STROKE} aria-hidden="true" />
      <span className="tool-label">{item.label}</span>
    </button>
  );
}

/**
 * One tool at a time, each with its word under it (DESIGN.md §6, P-6).
 */
export function ToolRail() {
  const mode = useEditor((s) => s.mode);
  const tool = useEditor((s) => s.tool);
  const armToolMode = useEditor((s) => s.armToolMode);

  const activeId = mode === "build" && tool ? String(tool) : "select";

  const select = (item: RailItem) => {
    if (item.tool === null) return;
    if (item.tool === "select") {
      armToolMode({ mode: "select" });
      return;
    }
    armToolMode({ mode: "build", tool: item.tool });
  };

  return (
    <GlassPanel
      as="nav"
      aria-label="Drawing tools"
      className="pointer-events-auto flex w-[72px] flex-col"
    >
      <div role="tablist" aria-orientation="vertical" className="flex flex-col items-center gap-1 p-2">
        {DRAWING_TOOLS.map((item) => (
          <ToolButton
            key={item.id}
            item={item}
            selected={activeId === item.id}
            onSelect={select}
          />
        ))}

        <hr className="my-1 w-8 border-0 border-t" style={{ borderColor: "var(--glass-border)" }} />

        {SECONDARY_ITEMS.map((item) => (
          <ToolButton key={item.id} item={item} selected={false} onSelect={select} />
        ))}
      </div>
    </GlassPanel>
  );
}
