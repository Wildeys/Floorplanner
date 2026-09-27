/**
 * Door and window type tags (FR-15).
 *
 * The reference sheets label openings by *type*, not by instance: every 800 ×
 * 2100 door on the project is `D03`, and the schedule then counts how many
 * there are. So a mark is assigned per distinct size, in order of first
 * appearance, and shared by every opening of that size.
 *
 * Falling back to the node's own name — which is what a first cut does — prints
 * "DOOR 1", "DOOR 2", "DOOR 3" for three identical doors. That is an instance
 * label, and it makes a schedule impossible: there is nothing to count.
 */

import type { SceneNodeLike } from "./plan-types.ts";

export type OpeningType = {
  readonly mark: string;
  readonly widthMm: number;
  readonly heightMm: number;
  readonly quantity: number;
};

export type OpeningMarks = {
  /** Node id → its type tag. */
  readonly byNodeId: ReadonlyMap<string, string>;
  /** The door schedule, in mark order. */
  readonly doors: readonly OpeningType[];
  /** The window schedule, in mark order. */
  readonly windows: readonly OpeningType[];
};

/** Round to the nearest millimetre so float noise cannot split a type. */
function mm(metres: number | undefined, fallback: number): number {
  return Math.round((metres ?? fallback) * 1000);
}

function pad(index: number): string {
  return String(index + 1).padStart(2, "0");
}

/**
 * Assign marks across the whole model, not per level.
 *
 * A door type spans the building: the same 800 mm door on the ground and first
 * floors is one type with a quantity of two, which is what the schedule has to
 * say. Numbering per level would give the same door two different marks.
 */
export function assignOpeningMarks(nodes: Iterable<SceneNodeLike>): OpeningMarks {
  const byNodeId = new Map<string, string>();
  const groups = {
    door: new Map<string, { widthMm: number; heightMm: number; ids: string[] }>(),
    window: new Map<string, { widthMm: number; heightMm: number; ids: string[] }>(),
  };

  // Sorted by id so the same model always yields the same marks — a drawing
  // set whose tags shuffle between exports is not reviewable.
  const openings = [...nodes]
    .filter((node) => node.type === "door" || node.type === "window")
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const node of openings) {
    const kind = node.type === "door" ? "door" : "window";
    const widthMm = mm(node.width, kind === "door" ? 0.9 : 1.2);
    const heightMm = mm(node.height, 2.1);
    const key = `${widthMm}x${heightMm}`;
    const bucket = groups[kind];
    const existing = bucket.get(key);
    if (existing) existing.ids.push(node.id);
    else bucket.set(key, { widthMm, heightMm, ids: [node.id] });
  }

  const build = (
    bucket: Map<string, { widthMm: number; heightMm: number; ids: string[] }>,
    prefix: "D" | "W",
  ): OpeningType[] => {
    const types: OpeningType[] = [];
    // Narrowest first, so D01 is the smallest door rather than whichever
    // happened to be drawn first.
    const entries = [...bucket.values()].sort(
      (a, b) => a.widthMm - b.widthMm || a.heightMm - b.heightMm,
    );
    entries.forEach((entry, index) => {
      const mark = `${prefix}${pad(index)}`;
      for (const id of entry.ids) byNodeId.set(id, mark);
      types.push({
        mark,
        widthMm: entry.widthMm,
        heightMm: entry.heightMm,
        quantity: entry.ids.length,
      });
    });
    return types;
  };

  const doors = build(groups.door, "D");
  const windows = build(groups.window, "W");

  return { byNodeId, doors, windows };
}
