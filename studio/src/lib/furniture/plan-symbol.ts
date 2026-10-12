/**
 * Place the furniture library's plan symbol into a footprint.
 *
 * The 2D view and the PDF both call this, so a desk is the same drawing in
 * both places. Coordinates inside the library are item-local millimetres with
 * the origin at the back-left corner; the footprint corners are already in
 * the caller's plan frame.
 */

import {
  FURNITURE_BY_ID,
  flattenSymbol,
  type FurnitureType,
} from "../sheets/furniture-library.ts";

import { INK, PEN } from "../sheets/pens.ts";
import type { PlanLabel, PlanPath, PlanPoint, PlanPolygon } from "../sheets/plan-types.ts";

/** Catalogue ids that correspond to a library symbol. */
const CATALOG_TO_LIBRARY: Readonly<Record<string, string>> = {
  sofa: "sofa",
  "my-leather-couch-modp80ha": "sofa",
  "office-chair": "office-chair",
  "herman-miller-aeron-mo8x36k9": "office-chair",
  "dining-chair": "chair",
  stool: "chair",
  "livingroom-chair": "armchair",
  "lounge-chair": "armchair",
  "office-table": "desk",
  "standing-desk-mo8wgz95": "desk",
  "dining-table": "table-rect",
  "dining-table-mo9ms5yh": "table-rect",
  "coffee-table": "table-rect",
  "single-bed": "bed-single",
  "double-bed": "bed-double",
  bunkbed: "bed-single",
  "bedside-table": "bedside-table",
  closet: "wardrobe",
  dresser: "wardrobe",
  "tv-stand": "tv-unit",
  television: "tv-unit",
  fridge: "fridge",
  toilet: "wc",
  "bathroom-sink": "basin-vanity",
  "shower-square": "shower-tray",
  "shower-angle": "shower-tray",
};

export type SymbolIdentity = {
  readonly name?: string;
  readonly asset?: { readonly id?: string; readonly name?: string };
};

export type PlacedSymbol = {
  readonly polygons: PlanPolygon[];
  readonly paths: PlanPath[];
  readonly labels: PlanLabel[];
};

function libraryIdFromName(name: string): string | null {
  const label = name.toLowerCase();
  if (label.includes("office chair") || label.includes("task chair") || label.includes("aeron")) {
    return "office-chair";
  }
  if (label.includes("armchair") || label.includes("lounge")) return "armchair";
  if (label.includes("chair")) return "chair";
  if (label.includes("sofa") || label.includes("couch")) return "sofa";
  if (label.includes("desk")) return "desk";
  if (label.includes("wardrobe") || label.includes("closet")) return "wardrobe";
  if (label.includes("single bed")) return "bed-single";
  if (label.includes("bed")) return "bed-double";
  if (label.includes("fridge") || label.includes("refrigerator")) return "fridge";
  if (label.includes("toilet") || label === "wc") return "wc";
  if (label.includes("basin") || label.includes("vanity") || label.includes("sink")) return "basin-vanity";
  if (label.includes("shower")) return "shower-tray";
  if (label.includes("round table")) return "table-round";
  if (label.includes("table")) return "table-rect";
  if (label.includes("tv")) return "tv-unit";
  return null;
}

/** Library type for a placed catalogue item, or null when we have no symbol. */
export function resolveLibraryId(item: SymbolIdentity): string | null {
  const id = item.asset?.id ?? "";
  if (CATALOG_TO_LIBRARY[id]) return CATALOG_TO_LIBRARY[id];
  if (FURNITURE_BY_ID.has(id)) return id;
  return libraryIdFromName(item.asset?.name ?? item.name ?? "");
}

function edgeLength(a: PlanPoint, b: PlanPoint): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/**
 * Map an item-local millimetre point onto the footprint.
 *
 * The library's origin is the BACK-left corner — back being the side that
 * goes against a wall, which at rotation 0 faces north, up the page. In
 * `planFootprintCorners`' output that corner is index **3**, not 0: its
 * corners run from local (-w/2, -d/2) and the second component is the plan
 * y, so corner 0 lands south-west and corner 3 north-west.
 *
 * Reading corner 0 as the origin draws every symbol flipped front-to-back —
 * a bed's headboard against the room instead of the wall — and no bounding
 * box check can see it, because a flip keeps the same extents.
 */
function mapPoint(corners: readonly PlanPoint[], widthMm: number, depthMm: number, x: number, y: number): PlanPoint {
  const u = widthMm > 0 ? x / widthMm : 0;
  const v = depthMm > 0 ? y / depthMm : 0;
  const [bx, by] = corners[3]!; // back-left: the library's (0, 0)
  const [rx, ry] = corners[2]!; // back-right: +x
  const [fx, fy] = corners[0]!; // front-left: +y
  return [bx + (rx - bx) * u + (fx - bx) * v, by + (ry - by) * u + (fy - by) * v];
}

function symbolSize(type: FurnitureType, widthMm: number, depthMm: number): { w: number; d: number; h: number } {
  if (type.keepSquare) {
    const side = Math.min(widthMm, depthMm);
    return { w: side, d: side, h: type.defaults.h };
  }
  return { w: widthMm, d: depthMm, h: type.defaults.h };
}

/**
 * Draw one library symbol inside `corners`.
 *
 * Returns null when the id is unknown or the footprint is not a quad, so the
 * caller can fall back to a plain rectangle.
 */
export function symbolInFootprint(
  libraryId: string,
  corners: readonly PlanPoint[],
  scale = 100,
): PlacedSymbol | null {
  const type = FURNITURE_BY_ID.get(libraryId);
  if (!type || corners.length < 4) return null;

  const widthMm = edgeLength(corners[0]!, corners[1]!) * 1000;
  const depthMm = edgeLength(corners[0]!, corners[3]!) * 1000;
  if (!(widthMm > 1) || !(depthMm > 1)) return null;

  const size = symbolSize(type, widthMm, depthMm);
  const flat = flattenSymbol(type.plan(size), size, scale);
  const project = (x: number, y: number) => mapPoint(corners, size.w, size.d, x, y);

  const polygons: PlanPolygon[] = [];
  const paths: PlanPath[] = [];
  for (const stroke of flat.strokes) {
    if (stroke.points.length < 2) continue;
    const points = stroke.points.map(([x, y]) => project(x, y));
    const weightMm = stroke.pen === "outline" ? PEN.seen : PEN.symbol;
    if (stroke.closed && !stroke.dashed) {
      polygons.push({ points, stroke: INK.line, weightMm });
      continue;
    }
    const open = stroke.closed ? [...points, points[0]!] : points;
    paths.push({
      points: open,
      stroke: INK.line,
      weightMm,
      dashed: stroke.dashed,
    });
  }

  const labels: PlanLabel[] = flat.texts.map((text) => ({
    at: project(text.x, text.y),
    text: text.text,
    sizeMm: text.sizeMm,
    align: "center" as const,
    rotateDeg: text.angleDeg || undefined,
  }));

  return { polygons, paths, labels };
}
