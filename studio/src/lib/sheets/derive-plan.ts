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

import {
  calculateLevelMiters,
  getWallPlanFootprint,
} from "@pascal-app/core/wall";

/** A point in plan space, metres. */
export type PlanPoint = readonly [number, number];

export type PlanPolygon = {
  readonly points: readonly PlanPoint[];
  /** Poché fill, as on a cut wall. Omit for an outline-only shape. */
  readonly fill?: string;
  readonly stroke?: string;
  readonly weightMm?: number;
};

export type PlanLabel = {
  readonly at: PlanPoint;
  readonly text: string;
  /** Cap height on paper in millimetres — a typographic size, never scaled. */
  readonly sizeMm?: number;
  readonly align?: "left" | "center";
  readonly bold?: boolean;
};

export type PlanDrawing = {
  readonly polygons: readonly PlanPolygon[];
  readonly labels: readonly PlanLabel[];
};

export type PlanBounds = {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
};

export type DerivedLevel = {
  readonly id: string;
  readonly name: string;
  readonly drawing: PlanDrawing;
  readonly bounds: PlanBounds;
  /** Sum of the level's zone areas, m². */
  readonly floorAreaM2: number;
  readonly wallCount: number;
};

/**
 * The minimal shape this module needs from a scene node. The pascal schema is
 * far wider; narrowing here keeps the derivation honest about what it reads and
 * makes it trivial to construct fixtures in tests.
 */
export type SceneNodeLike = {
  readonly id: string;
  readonly type?: string;
  readonly name?: string;
  readonly parentId?: string | null;
  readonly start?: readonly [number, number];
  readonly end?: readonly [number, number];
  readonly thickness?: number;
  readonly polygon?: readonly (readonly [number, number])[];
  readonly baseElevation?: number;
  readonly visible?: boolean;
};

export type SceneNodes = Readonly<Record<string, SceneNodeLike>>;

const WALL_POCHE = "#1a1a1a";
const ROOM_LABEL_MM = 2.2;
const AREA_LABEL_MM = 1.8;

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

function boundsOf(polygons: readonly PlanPolygon[]): PlanBounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const polygon of polygons) {
    for (const [x, y] of polygon.points) {
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
export function deriveWallPolygons(walls: readonly SceneNodeLike[]): PlanPolygon[] {
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
      fill: WALL_POCHE,
      stroke: WALL_POCHE,
      weightMm: 0.25,
    });
  }
  return polygons;
}

export type DeriveOptions = {
  /** Include zone name and area tags. */
  readonly roomLabels?: boolean;
};

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
  const { roomLabels = true } = options;
  const levels = collectLevels(nodes);
  const levelIds = new Set(levels.map((level) => level.id));

  const wallsByLevel = new Map<string, SceneNodeLike[]>();
  const zonesByLevel = new Map<string, SceneNodeLike[]>();

  for (const node of Object.values(nodes)) {
    if (!isVisible(node)) continue;
    if (node.type !== "wall" && node.type !== "zone") continue;
    const levelId = findLevelAncestor(nodes, node.id, levelIds);
    if (!levelId) continue;
    const bucket = node.type === "wall" ? wallsByLevel : zonesByLevel;
    const existing = bucket.get(levelId);
    if (existing) existing.push(node);
    else bucket.set(levelId, [node]);
  }

  const derived: DerivedLevel[] = [];
  for (const level of levels) {
    const walls = wallsByLevel.get(level.id) ?? [];
    const polygons = deriveWallPolygons(walls);
    if (polygons.length === 0) continue;

    const zones = zonesByLevel.get(level.id) ?? [];
    const labels: PlanLabel[] = [];
    let floorAreaM2 = 0;

    for (const zone of zones) {
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
        sizeMm: ROOM_LABEL_MM,
        align: "center",
        bold: true,
      });
      labels.push({
        at: [cx, cy - 0.45],
        text: `${area.toFixed(2)} m²`,
        sizeMm: AREA_LABEL_MM,
        align: "center",
      });
    }

    derived.push({
      id: level.id,
      name: level.name ?? "LEVEL",
      drawing: { polygons, labels },
      bounds: boundsOf(polygons),
      floorAreaM2,
      wallCount: walls.length,
    });
  }

  return derived;
}

export function boundsExtent(bounds: PlanBounds): { width: number; height: number } {
  return {
    width: Math.max(bounds.maxX - bounds.minX, 1e-6),
    height: Math.max(bounds.maxY - bounds.minY, 1e-6),
  };
}
