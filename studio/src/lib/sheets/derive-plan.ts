/**
 * Scene graph → plan geometry (REQUIREMENTS.md FR-500, FR-502).
 *
 * This is the derivation layer: it walks the node graph and produces flat
 * vector geometry in plan metres, ready to be placed on a sheet at a declared
 * scale. It is deliberately pure — no React, no DOM, no Three.js — so a sheet
 * can be produced on a server, in a test, or from a background job. That is the
 * requirement's core claim: sheets are derived from the model, never
 * screenshotted from the 3D view.
 *
 * Wall outlines come from `@pascal-app/core`'s own mitring maths rather than a
 * reimplementation, so corner joins on our sheets match what the user sees in
 * the editor. Getting mitring subtly different would make every corner of every
 * drawing wrong in a way that is hard to spot and impossible to defend.
 *
 * Plan space is the XZ world plane: `wall.start` / `wall.end` are `[x, z]` in
 * metres. Here that becomes `[x, y]` with y increasing "up" the page.
 */

import { calculateLevelMiters, getWallPlanFootprint } from "@pascal-app/core/wall";

import { deriveItemFootprint, deriveOpening } from "./derive-openings.ts";
import { assignOpeningMarks, type OpeningMarks } from "./opening-marks.ts";
import { INK, MASONRY_HATCH, PEN, TEXT_MM } from "./pens.ts";
import type {
  PlanBounds,
  PlanDrawing,
  PlanLabel,
  PlanPath,
  PlanPoint,
  PlanPolygon,
  SceneNodeLike,
  SceneNodes,
} from "./plan-types.ts";

export type {
  PlanBounds,
  PlanDrawing,
  PlanLabel,
  PlanPath,
  PlanPoint,
  PlanPolygon,
  SceneNodeLike,
  SceneNodes,
} from "./plan-types.ts";

export type DerivedLevel = {
  readonly id: string;
  readonly name: string;
  readonly drawing: PlanDrawing;
  /** The building itself — the mitred outer face of its walls. */
  readonly bounds: PlanBounds;
  /**
   * The level's walls, kept so the sheet engine can derive dimension chains
   * once it knows the scale. Annotation offsets are paper dimensions, so they
   * cannot be built here.
   */
  readonly walls: readonly SceneNodeLike[];
  /** Sum of the level's zone areas, m². */
  readonly floorAreaM2: number;
  readonly wallCount: number;
  readonly openingCount: number;
  readonly itemCount: number;
};

function isVisible(node: SceneNodeLike): boolean {
  return node.visible !== false;
}

/**
 * Walk up `parentId` to the nearest level ancestor.
 *
 * Walls are not always direct children of a level — they can sit under a zone
 * or a group — so a one-step parent check would silently drop geometry and
 * produce a sheet that looks plausible but is missing walls.
 */
export function findLevelAncestor(
  nodes: SceneNodes,
  nodeId: string,
  levelIds: ReadonlySet<string>,
): string | null {
  const seen = new Set<string>();
  let current: string | null | undefined = nodeId;
  while (current && !seen.has(current)) {
    seen.add(current);
    const node: SceneNodeLike | undefined = nodes[current];
    if (!node) return null;
    const parent: string | null | undefined = node.parentId;
    if (parent && levelIds.has(parent)) return parent;
    current = parent ?? null;
  }
  return null;
}

export function collectLevels(nodes: SceneNodes): SceneNodeLike[] {
  return Object.values(nodes)
    .filter((node) => node.type === "level" && isVisible(node))
    .sort((a, b) => (a.baseElevation ?? 0) - (b.baseElevation ?? 0));
}

function boundsOf(shapes: readonly { points: readonly PlanPoint[] }[]): PlanBounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const shape of shapes) {
    for (const [x, y] of shape.points) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}

/** Shoelace area of a simple polygon, m². Sign-independent. */
export function polygonArea(points: readonly PlanPoint[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i]!;
    const [x2, y2] = points[(i + 1) % points.length]!;
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

export function polygonCentroid(points: readonly PlanPoint[]): PlanPoint {
  if (points.length === 0) return [0, 0];
  let cx = 0;
  let cy = 0;
  let twiceArea = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i]!;
    const [x2, y2] = points[(i + 1) % points.length]!;
    const cross = x1 * y2 - x2 * y1;
    twiceArea += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  if (Math.abs(twiceArea) < 1e-12) {
    // Degenerate (collinear) — fall back to the vertex mean.
    const n = points.length;
    return [
      points.reduce((sum, p) => sum + p[0], 0) / n,
      points.reduce((sum, p) => sum + p[1], 0) / n,
    ];
  }
  const factor = 1 / (3 * twiceArea);
  return [cx * factor, cy * factor];
}

/**
 * Wall plan outlines for one level, mitred at the junctions.
 *
 * `calculateLevelMiters` resolves the corner geometry across the whole level at
 * once, so walls must be passed together rather than one at a time.
 */
export function deriveWallPolygons(
  walls: readonly SceneNodeLike[],
  fill: WallFill = "solid",
): PlanPolygon[] {
  const usable = walls.filter(
    (wall) => Array.isArray(wall.start) && Array.isArray(wall.end),
  );
  if (usable.length === 0) return [];

  // The core helpers are typed against the full WallNode schema; our narrowed
  // view carries every field they actually read (id, start, end, thickness).
  const wallNodes = usable as unknown as Parameters<typeof calculateLevelMiters>[0];
  const miterData = calculateLevelMiters(wallNodes);

  const polygons: PlanPolygon[] = [];
  for (const wall of wallNodes) {
    const footprint = getWallPlanFootprint(wall, miterData);
    if (footprint.length < 3) continue;
    polygons.push({
      points: footprint.map((point) => [point.x, point.y] as PlanPoint),
      fill: fill === "solid" ? INK.poche : undefined,
      hatch: fill === "hatch" ? MASONRY_HATCH : undefined,
      stroke: INK.line,
      weightMm: PEN.cut,
    });
  }
  return polygons;
}

/**
 * How cut walls are filled.
 *
 * The reference set prints solid poché on its 1:100 plans and reserves the
 * ruled block-masonry pattern for the 1:20 details, where it is legible. So
 * `solid` is the default for plans, and `hatch` exists for detail scales.
 */
export type WallFill = "solid" | "hatch";

export type DeriveOptions = {
  /** Include zone name and area tags. */
  readonly roomLabels?: boolean;
  /** Include door / window type tags (D01, W01…). */
  readonly openingMarks?: boolean;
  /** Include furniture and fixture outlines. */
  readonly furniture?: boolean;
  readonly wallFill?: WallFill;
};

const COLLECTED_TYPES = new Set(["wall", "zone", "door", "window", "item"]);

/**
 * Derive one plan drawing per level, ordered from the lowest storey up.
 *
 * Levels with no wall geometry are dropped rather than emitted as blank sheets
 * — an empty page in a submission set reads as an omission, not as an
 * intentionally empty storey.
 */
export function derivePlanLevels(
  nodes: SceneNodes,
  options: DeriveOptions = {},
): DerivedLevel[] {
  const {
    roomLabels = true,
    openingMarks = true,
    furniture = true,
    wallFill = "solid",
  } = options;
  const levels = collectLevels(nodes);
  const levelIds = new Set(levels.map((level) => level.id));

  const byLevel = new Map<string, Map<string, SceneNodeLike[]>>();
  for (const node of Object.values(nodes)) {
    if (!isVisible(node)) continue;
    if (!node.type || !COLLECTED_TYPES.has(node.type)) continue;
    const levelId = findLevelAncestor(nodes, node.id, levelIds);
    if (!levelId) continue;
    let buckets = byLevel.get(levelId);
    if (!buckets) {
      buckets = new Map();
      byLevel.set(levelId, buckets);
    }
    const bucket = buckets.get(node.type);
    if (bucket) bucket.push(node);
    else buckets.set(node.type, [node]);
  }

  // Marks span the whole model: the same door on two storeys is one type with
  // a quantity of two, which is what a schedule has to say.
  const marks = assignOpeningMarks(Object.values(nodes));

  const derived: DerivedLevel[] = [];
  for (const level of levels) {
    const buckets = byLevel.get(level.id) ?? new Map<string, SceneNodeLike[]>();
    const walls = buckets.get("wall") ?? [];
    const polygons = deriveWallPolygons(walls, wallFill);
    if (polygons.length === 0) continue;

    const wallsById = new Map(walls.map((wall) => [wall.id, wall]));
    const knockOuts: PlanPolygon[] = [];
    const paths: PlanPath[] = [];
    const labels: PlanLabel[] = [];

    // Openings resolve against their host wall; one without a resolvable host
    // is skipped rather than drawn adrift.
    let openingCount = 0;
    for (const type of ["door", "window"] as const) {
      for (const node of buckets.get(type) ?? []) {
        const wall = node.wallId ? wallsById.get(node.wallId) : undefined;
        if (!wall) continue;
        const opening = deriveOpening(node, wall, {
          showMarks: openingMarks,
          mark: marks.byNodeId.get(node.id),
        });
        if (!opening) continue;
        openingCount += 1;
        knockOuts.push(opening.knockOut);
        paths.push(...opening.paths);
        if (opening.label) labels.push(opening.label);
      }
    }

    const itemPolygons: PlanPolygon[] = [];
    if (furniture) {
      for (const item of buckets.get("item") ?? []) {
        const footprint = deriveItemFootprint(item);
        if (footprint) itemPolygons.push(footprint);
      }
    }

    let floorAreaM2 = 0;
    for (const zone of buckets.get("zone") ?? []) {
      const polygon = zone.polygon;
      if (!polygon || polygon.length < 3) continue;
      const points = polygon.map((p) => [p[0], p[1]] as PlanPoint);
      const area = polygonArea(points);
      floorAreaM2 += area;
      if (!roomLabels) continue;
      const [cx, cy] = polygonCentroid(points);
      labels.push({
        at: [cx, cy],
        text: (zone.name ?? "ROOM").toUpperCase(),
        sizeMm: TEXT_MM.roomName,
        align: "center",
        bold: true,
      });
      labels.push({
        at: [cx, cy - 0.45],
        text: `${area.toFixed(2)} m²`,
        sizeMm: TEXT_MM.roomArea,
        align: "center",
      });
    }

    derived.push({
      id: level.id,
      name: level.name ?? "LEVEL",
      // Furniture sits below the cut plane, so it is drawn with the walls but
      // knocked out by nothing — order within `polygons` keeps it under the
      // wall poché where they overlap.
      drawing: {
        polygons: [...itemPolygons, ...polygons],
        knockOuts,
        paths,
        labels,
      },
      bounds: boundsOf(polygons),
      walls,
      floorAreaM2,
      wallCount: walls.length,
      openingCount,
      itemCount: itemPolygons.length,
    });
  }

  return derived;
}

/** The project-wide door and window schedule (FR-505, FR-506). */
export function deriveOpeningSchedule(nodes: SceneNodes): OpeningMarks {
  return assignOpeningMarks(Object.values(nodes));
}

export function boundsExtent(bounds: PlanBounds): { width: number; height: number } {
  return {
    width: Math.max(bounds.maxX - bounds.minX, 1e-6),
    height: Math.max(bounds.maxY - bounds.minY, 1e-6),
  };
}
