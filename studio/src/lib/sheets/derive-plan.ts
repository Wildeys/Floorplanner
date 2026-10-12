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
 * metres. Pascal puts north at world -Z (see the editor's floorplan geometry
 * module), while a drawing is read with north up the page, so the two frames
 * have opposite orientation and `toPlanFrame` reflects between them.
 */

import { calculateLevelMiters, getWallPlanFootprint } from "@pascal-app/core/wall";

import { resolveLibraryId, symbolInFootprint } from "../furniture/plan-symbol.ts";
import { deriveColumnFootprint, deriveItemFootprint, deriveOpening } from "./derive-openings.ts";
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
  fill: WallFill = "hatch",
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
 * `hatch` is the default because that is what the reference sheets print:
 * cross-hatched block masonry, with a matching legend swatch. `solid` stays
 * available for a profile whose convention is poché.
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

const COLLECTED_TYPES = new Set(["wall", "zone", "door", "window", "item", "column"]);

/**
 * World XZ -> plan XY.
 *
 * North is world -Z, but a plan is read with north up the page, so plan
 * y = -z. The two frames have opposite orientation, which makes this a
 * reflection rather than a rotation — and a reflection reverses signed angles.
 * So everything carrying a handedness has to be reversed with it:
 *
 *   - a door's swing side, or every door is drawn opening through its wall
 *
 * An item's Y rotation is the exception, and it reads like a bug until you
 * work it through. three's `rotateY(t)` sends local +X to `(cos t, -sin t)`
 * in world (x, z); mirroring z into plan y gives `(cos t, +sin t)`, which is
 * an anticlockwise turn of the same magnitude. The reflection and three's
 * rotation sense cancel, so the plan angle *is* `rotation[1]`, unnegated.
 * Negating it here mirrors every rotated item — invisible while furniture is
 * a symmetric rectangle, obvious the moment a real symbol is drawn.
 *
 * `position[0]` on a door or window is a distance measured along its host
 * wall, not a world coordinate, so it is deliberately left alone.
 *
 * Mirroring the node graph once here keeps the correction in a single place:
 * wall mitring, opening symbols, item footprints, zone outlines and the
 * dimension chains downstream all then work in one consistent frame.
 */
function isPointLoop(
  polygon: SceneNodeLike["polygon"],
): polygon is readonly (readonly [number, number])[] {
  return Array.isArray(polygon);
}

export function toPlanFrame(nodes: SceneNodes): SceneNodes {
  const mirrored: Record<string, SceneNodeLike> = {};
  for (const [id, node] of Object.entries(nodes)) {
    const next: Record<string, unknown> = { ...node };

    if (node.start) next.start = [node.start[0], -node.start[1]];
    if (node.end) next.end = [node.end[0], -node.end[1]];
    // Zones store a point loop. The site stores `{ type, points }`. Mapping
    // the object throws, and the sheet strip derives on every scene — including
    // the default site — so a non-loop has to be mirrored by its points.
    const polygon = node.polygon;
    if (isPointLoop(polygon)) {
      next.polygon = polygon.map((point) => [point[0], -point[1]] as const);
    } else if (polygon?.points) {
      next.polygon = {
        ...polygon,
        points: polygon.points.map((point) => [point[0], -point[1]] as const),
      };
    }

    if (node.type === "item" || node.type === "column") {
      if (node.position) {
        next.position = [node.position[0] ?? 0, node.position[1] ?? 0, -(node.position[2] ?? 0)];
      }
      // `rotation` is carried across unchanged — see the note above. A
      // column's is a scalar rather than a triple, which is the other reason
      // not to rewrite it here.
    }

    if (node.type === "door" || node.type === "window") {
      // An unset swing still has a handedness — the derivation treats it as
      // "outward" — so the default has to flip with everything else.
      next.swingDirection = node.swingDirection === "inward" ? "outward" : "inward";
    }

    mirrored[id] = next as SceneNodeLike;
  }
  return mirrored;
}

/**
 * Derive one plan drawing per level, ordered from the lowest storey up.
 *
 * Levels with no wall geometry are dropped rather than emitted as blank sheets
 * — an empty page in a submission set reads as an omission, not as an
 * intentionally empty storey.
 */
export function derivePlanLevels(
  worldNodes: SceneNodes,
  options: DeriveOptions = {},
): DerivedLevel[] {
  const {
    roomLabels = true,
    openingMarks = true,
    furniture = true,
    wallFill = "hatch",
  } = options;
  const nodes = toPlanFrame(worldNodes);
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

    // Which side of a wall is "inside" cannot be read off the wall itself —
    // its normal points left of start → end, and nothing normalises which end
    // was drawn first. The centre of the storey's own walls is a good enough
    // answer for deciding which way an opening's tag should sit.
    const centre = polygonCentroid(polygons.flatMap((polygon) => polygon.points));
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
          toward: centre,
        });
        if (!opening) continue;
        openingCount += 1;
        knockOuts.push(opening.knockOut);
        paths.push(...opening.paths);
        if (opening.label) labels.push(opening.label);
      }
    }

    // Solid black over the hatch: the reference reserves a filled poché for
    // structure, and drawing it after the walls is what makes it read.
    const columnPolygons: PlanPolygon[] = [];
    for (const column of buckets.get("column") ?? []) {
      const footprint = deriveColumnFootprint(column);
      if (footprint) columnPolygons.push(footprint);
    }

    const itemPolygons: PlanPolygon[] = [];
    let itemCount = 0;
    if (furniture) {
      for (const item of buckets.get("item") ?? []) {
        const footprint = deriveItemFootprint(item);
        if (!footprint) continue;
        itemCount += 1;
        const libraryId = resolveLibraryId(item);
        const symbol = libraryId ? symbolInFootprint(libraryId, footprint.points) : null;
        if (symbol) {
          itemPolygons.push(...symbol.polygons);
          paths.push(...symbol.paths);
          labels.push(...symbol.labels);
        } else {
          itemPolygons.push(footprint);
        }
      }
    }

    let floorAreaM2 = 0;
    for (const zone of buckets.get("zone") ?? []) {
      const polygon = zone.polygon;
      if (!Array.isArray(polygon) || polygon.length < 3) continue;
      const points = polygon.map((p) => [p[0], p[1]] as PlanPoint);
      const area = polygonArea(points);
      floorAreaM2 += area;
      if (!roomLabels) continue;
      const [cx, cy] = polygonCentroid(points);
      // A boxed name tag and no area figure, as the reference sheets draw it.
      // The area is still accumulated into `floorAreaM2` for the schedules —
      // it just does not belong on the plan, where it lands on top of the
      // furniture and, for a zone covering part of a room, reads as wrong.
      labels.push({
        at: [cx, cy],
        text: (zone.name ?? "ROOM").toUpperCase(),
        sizeMm: TEXT_MM.roomName,
        align: "center",
        bold: true,
        shape: "box",
      });
    }

    derived.push({
      id: level.id,
      name: level.name ?? "LEVEL",
      // Furniture sits below the cut plane, so it is drawn with the walls but
      // knocked out by nothing — order within `polygons` keeps it under the
      // wall poché where they overlap.
      drawing: {
        polygons: [...itemPolygons, ...polygons, ...columnPolygons],
        knockOuts,
        paths,
        labels,
      },
      bounds: boundsOf(polygons),
      walls,
      floorAreaM2,
      wallCount: walls.length,
      openingCount,
      itemCount,
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
