/**
 * Doors, windows and furniture in plan (FR-14, FR-15, FR-21, FR-24).
 *
 * ## How an opening is placed
 *
 * A door or window stores `wallId` plus `position[0]`, which Pascal's own
 * wall-topology treats as a distance in metres **from that wall's start point**
 * along its axis (see `attachmentSpan` / the `totalLength * startT` comparison
 * in `core/systems/wall/wall-topology.js`). `width` is the clear span. So the
 * opening occupies `position[0] ± width/2` measured along the wall, and spans
 * the full wall thickness across it.
 *
 * ## Why openings are painted, not subtracted
 *
 * The opening is knocked out by overdrawing the wall in the sheet colour rather
 * than by booleaning it out of the mitred wall polygon. A boolean against
 * mitred outlines is a great deal more code with many more ways to be quietly
 * wrong at corners, and on an opaque sheet the printed result is identical.
 * Draw order therefore matters: walls, then knock-outs, then jambs, then
 * symbols.
 */

import { planFootprintCorners } from "@pascal-app/core/plan-footprint";
import { getScaledDimensions } from "@pascal-app/core/schema";

import { INK, PEN, TEXT_MM } from "./pens.ts";
import type { PlanLabel, PlanPath, PlanPoint, PlanPolygon, SceneNodeLike } from "./plan-types.ts";

const DEFAULT_WALL_THICKNESS = 0.1;
const DEFAULT_OPENING_WIDTH = 0.9;

type WallGeometry = {
  readonly start: PlanPoint;
  readonly end: PlanPoint;
  readonly thickness: number;
  readonly length: number;
  /** Unit vector along the wall, start → end. */
  readonly axis: PlanPoint;
  /** Unit normal, left of the axis. */
  readonly normal: PlanPoint;
};

export function wallGeometry(wall: SceneNodeLike): WallGeometry | null {
  if (!wall.start || !wall.end) return null;
  const [sx, sy] = wall.start;
  const [ex, ey] = wall.end;
  const dx = ex - sx;
  const dy = ey - sy;
  const length = Math.hypot(dx, dy);
  if (length < 1e-9) return null;
  return {
    start: [sx, sy],
    end: [ex, ey],
    thickness: wall.thickness ?? DEFAULT_WALL_THICKNESS,
    length,
    axis: [dx / length, dy / length],
    normal: [-dy / length, dx / length],
  };
}

function alongWall(geometry: WallGeometry, distance: number, offset: number): PlanPoint {
  return [
    geometry.start[0] + geometry.axis[0] * distance + geometry.normal[0] * offset,
    geometry.start[1] + geometry.axis[1] * distance + geometry.normal[1] * offset,
  ];
}

export type DerivedOpening = {
  /** Sheet-coloured knock-out removing the wall across the opening. */
  readonly knockOut: PlanPolygon;
  /** Jamb faces and the symbol (swing arc, sill lines). */
  readonly paths: readonly PlanPath[];
  readonly label: PlanLabel | null;
};

/**
 * Approximate a circular arc as a polyline.
 *
 * A door swing is a quarter circle; 12 segments is under a tenth of a
 * millimetre of chord error at 1:100 and keeps the emitted PDF small.
 */
function arc(
  centre: PlanPoint,
  radius: number,
  fromRad: number,
  toRad: number,
  segments = 12,
): PlanPoint[] {
  const points: PlanPoint[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const angle = fromRad + ((toRad - fromRad) * i) / segments;
    points.push([
      centre[0] + Math.cos(angle) * radius,
      centre[1] + Math.sin(angle) * radius,
    ]);
  }
  return points;
}

/**
 * Derive one door or window sitting in a wall.
 *
 * Returns null when the host wall is missing or degenerate — an opening with
 * nowhere to sit is dropped rather than drawn floating in space.
 */
export function deriveOpening(
  node: SceneNodeLike,
  wall: SceneNodeLike,
  options: { showMarks: boolean; mark?: string; toward?: readonly [number, number] },
): DerivedOpening | null {
  const geometry = wallGeometry(wall);
  if (!geometry) return null;

  const width = node.width ?? DEFAULT_OPENING_WIDTH;
  const centre = node.position?.[0] ?? geometry.length / 2;
  const half = width / 2;
  const start = Math.max(0, centre - half);
  const end = Math.min(geometry.length, centre + half);
  if (end - start < 1e-6) return null;

  // Overshoot the wall faces slightly so the knock-out fully clears the wall's
  // own outline stroke instead of leaving a hairline across the opening.
  const reach = geometry.thickness / 2 + PEN.cut / 1000;

  const knockOut: PlanPolygon = {
    points: [
      alongWall(geometry, start, reach),
      alongWall(geometry, end, reach),
      alongWall(geometry, end, -reach),
      alongWall(geometry, start, -reach),
    ],
    fill: INK.paper,
    weightMm: 0,
  };

  const jambHalf = geometry.thickness / 2;
  const paths: PlanPath[] = [
    {
      points: [alongWall(geometry, start, jambHalf), alongWall(geometry, start, -jambHalf)],
      stroke: INK.line,
      weightMm: PEN.opening,
    },
    {
      points: [alongWall(geometry, end, jambHalf), alongWall(geometry, end, -jambHalf)],
      stroke: INK.line,
      weightMm: PEN.opening,
    },
  ];

  if (node.type === "window") {
    // Two lines across the reveal, the glazing line between them — how the
    // reference set draws W01 / W02 at 1:100.
    for (const offset of [jambHalf * 0.55, 0, -jambHalf * 0.55]) {
      paths.push({
        points: [alongWall(geometry, start, offset), alongWall(geometry, end, offset)],
        stroke: INK.line,
        weightMm: PEN.symbol,
      });
    }
  } else {
    // Door: leaf drawn open across the opening, plus its swing arc.
    const hingeAtStart = node.hingesSide !== "right";
    const hinge = hingeAtStart ? start : end;
    const swingSign = node.swingDirection === "inward" ? -1 : 1;

    const hingePoint = alongWall(geometry, hinge, 0);
    const axisAngle = Math.atan2(geometry.axis[1], geometry.axis[0]);
    const towardOpening = hingeAtStart ? axisAngle : axisAngle + Math.PI;
    const swung = towardOpening + swingSign * (Math.PI / 2);

    paths.push({
      points: [
        hingePoint,
        [
          hingePoint[0] + Math.cos(swung) * width,
          hingePoint[1] + Math.sin(swung) * width,
        ],
      ],
      stroke: INK.line,
      weightMm: PEN.opening,
    });

    paths.push({
      points: arc(hingePoint, width, towardOpening, swung),
      stroke: INK.line,
      weightMm: PEN.symbol,
    });
  }

  // The type tag (D01, W01…) as printed on the reference schedules (FR-15).
  // The caller assigns it across the whole model; the node's own `mark` is a
  // fallback, and its `name` is deliberately not used — that is an instance
  // label ("Door 1"), which cannot be scheduled.
  const mark = options.mark ?? node.mark;
  let label: PlanLabel | null = null;
  if (options.showMarks && mark) {
    /*
     * The tag goes *inboard*, in a hexagon, as the reference sheets draw it.
     *
     * Two things were wrong with putting it outboard at a fixed -0.35 m. The
     * offset was a plan metre pretending to be a paper one, so it moved
     * across the page whenever a storey resolved to a different scale; and
     * -normal is only "outside" by accident, because which way a wall's
     * normal points depends on the order its ends happen to be stored in. On
     * a perimeter wall the two together put the mark in the dimension band.
     *
     * Inboard has neither problem: it cannot collide with annotation that by
     * definition lives outside the building, and the offset is sized from the
     * opening it belongs to rather than from the paper.
     */
    const clear = jambHalf + Math.max(0.3, (end - start) * 0.4);
    const candidates = [
      alongWall(geometry, (start + end) / 2, clear),
      alongWall(geometry, (start + end) / 2, -clear),
    ] as const;
    const toward = options.toward;
    const at = toward
      ? candidates.reduce((best, point) =>
          Math.hypot(point[0] - toward[0], point[1] - toward[1]) <
          Math.hypot(best[0] - toward[0], best[1] - toward[1])
            ? point
            : best,
        )
      : candidates[1]!;
    label = {
      at,
      text: mark.toUpperCase(),
      sizeMm: TEXT_MM.openingMark,
      align: "center",
      shape: "hexagon",
    };
  }

  return { knockOut, paths, label };
}

/**
 * The plan size of a placed item, in metres.
 *
 * A real placed item has no top-level `dimensions`: its size lives on the
 * catalogue asset and is multiplied by the node's own scale, which is what
 * `getScaledDimensions` does. Reading `item.dimensions` directly returns
 * undefined for everything the catalogue places, which silently drops every
 * piece of furniture from the drawing.
 */
export function itemDimensions(item: SceneNodeLike): readonly number[] | null {
  const asset = item.asset;
  if (asset && Array.isArray(asset.dimensions)) {
    try {
      return getScaledDimensions(item as never);
    } catch {
      // A malformed asset or missing scale: fall through to the plain field.
    }
    const [w, h, d] = asset.dimensions;
    const scale = item.scale ?? [1, 1, 1];
    return [w * (scale[0] ?? 1), h * (scale[1] ?? 1), d * (scale[2] ?? 1)];
  }
  return item.dimensions ?? null;
}

/**
 * Furniture and fixtures in plan (FR-21, FR-24).
 *
 * The footprint comes from core's `planFootprintCorners`, the same helper the
 * editor's spatial grid uses for placement, so what the drawing shows is what
 * the model actually reserves — rather than a second, subtly different idea of
 * where the object sits.
 *
 * Items are drawn as outlines at the "seen" weight: they sit below the cut
 * plane, so they must never compete with the walls.
 */
export function deriveItemFootprint(item: SceneNodeLike): PlanPolygon | null {
  const position = item.position;
  const dimensions = itemDimensions(item);
  if (!position || !dimensions) return null;
  if (!(dimensions[0]! > 0) || !(dimensions[2]! > 0)) return null;

  // Core's own footprint maths, so a placed item occupies exactly the cells the
  // editor's spatial grid reserved for it. Note `planFootprintCorners` sends
  // local +X to `(cos, sin)` — the transpose of three's Y rotation, so it is
  // already expressed in the mirrored plan frame. Feeding it the unnegated
  // `rotation[1]` is therefore correct; negating first mirrors the item.
  const rotationY = Array.isArray(item.rotation) ? (item.rotation[1] ?? 0) : 0;
  const corners = planFootprintCorners(
    [position[0]!, position[1] ?? 0, position[2] ?? 0],
    [dimensions[0]!, dimensions[1] ?? 0, dimensions[2]!],
    rotationY,
  );
  if (corners.length < 3) return null;

  return {
    points: corners.map(([x, z]) => [x, z] as PlanPoint),
    stroke: INK.line,
    weightMm: PEN.seen,
  };
}

/**
 * A column in plan.
 *
 * The one thing the reference sheets fill solid: a hatched wall with a black
 * square at each grid intersection is how A.02 reads, and it is how a reader
 * tells structure from infill at a glance. Drawn after the walls so it sits
 * over the hatch.
 */
export function deriveColumnFootprint(column: SceneNodeLike): PlanPolygon | null {
  const position = column.position;
  if (!position) return null;
  const [x, , z] = [position[0] ?? 0, position[1] ?? 0, position[2] ?? 0];

  const solid = {
    fill: INK.poche,
    stroke: INK.line,
    weightMm: PEN.cut,
  } as const;

  const round = column.crossSection === undefined || column.crossSection === "round";
  if (round) {
    const radius = column.radius ?? 0.22;
    if (!(radius > 0)) return null;
    // 24 segments: under a hundredth of a millimetre of chord error at 1:100.
    const points: PlanPoint[] = [];
    for (let i = 0; i < 24; i += 1) {
      const angle = (Math.PI * 2 * i) / 24;
      points.push([x + Math.cos(angle) * radius, z + Math.sin(angle) * radius]);
    }
    return { points, ...solid };
  }

  const width = column.width ?? 0.44;
  const depth = column.depth ?? 0.44;
  if (!(width > 0) || !(depth > 0)) return null;
  // A column's `rotation` is a scalar, unlike an item's triple.
  const angle = typeof column.rotation === "number" ? column.rotation : 0;
  const corners = planFootprintCorners([x, 0, z], [width, 0, depth], angle);
  if (corners.length < 3) return null;
  return { points: corners.map(([cx, cz]) => [cx, cz] as PlanPoint), ...solid };
}
