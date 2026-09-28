/**
 * Dimension strings and grid bubbles (FR-1A, FR-1B).
 *
 * The reference sheets carry two chains on each side: a running chain between
 * the structural gridlines, and an overall dimension outside it. Each reading
 * is printed twice — millimetres on the first line, bracketed feet-and-inches
 * on the second.
 *
 * ## Where the stations come from
 *
 * A customer-drawn plan has no structural grid to measure between, so the
 * stations are derived from the building itself: the x of every wall that runs
 * (near enough) north–south, and the y of every wall that runs east–west. On a
 * real plan those are exactly the lines a draughtsman would dimension to,
 * because they are where the structure actually changes.
 *
 * ## Units
 *
 * Every offset and tick here is a **paper millimetre**, converted to plan
 * metres against the drawing's scale. A dimension chain sits the same distance
 * off the building on a 1:50 sheet as on a 1:200 one — that is what makes a set
 * look consistent. Expressing these in plan metres instead makes the whole
 * apparatus swell and shrink with the scale, which is wrong and obvious.
 *
 * This is why the annotation is derived by the sheet engine rather than with
 * the geometry: it cannot be built until the scale is known.
 */

import { formatDimension, type UnitDisplay } from "./jurisdiction.ts";
import { INK, PEN, TEXT_MM } from "./pens.ts";
import type { PlanBounds, PlanLabel, PlanPath, PlanPoint, SceneNodeLike } from "./plan-types.ts";

/** Two stations closer than this are the same line (5 mm on site). */
const STATION_TOLERANCE_M = 0.005;

/** A wall within this of an axis counts as running along it. */
const AXIS_TOLERANCE = 0.02;

/** The dimension apparatus, in paper millimetres. */
const PAPER_MM = {
  /** Gap between the building and the first chain. */
  firstChainOffset: 9,
  /** Gap between the running chain and the overall chain. */
  chainSpacing: 8,
  /** How far extension lines overshoot the dimension line. */
  extensionOvershoot: 1.5,
  /** Gap between the building and the start of an extension line. */
  extensionGap: 2,
  /** Half-length of the 45° architectural tick. */
  tickHalf: 1.2,
  /** Text baseline offset above the dimension line. */
  textOffset: 1.8,
  /** Grid bubble radius. */
  bubbleRadius: 3.2,
  /** Gap between the outer chain and the bubble centres. */
  bubbleOffset: 7,
} as const;

/** Paper millimetres → plan metres at a given scale. 10 mm at 1:100 is 1 m. */
function toPlan(paperMm: number, scale: number): number {
  return (paperMm * scale) / 1000;
}

/** The apparatus resolved into plan metres for one scale. */
function geometryFor(scale: number) {
  return {
    firstChainOffset: toPlan(PAPER_MM.firstChainOffset, scale),
    chainSpacing: toPlan(PAPER_MM.chainSpacing, scale),
    extensionOvershoot: toPlan(PAPER_MM.extensionOvershoot, scale),
    extensionGap: toPlan(PAPER_MM.extensionGap, scale),
    tickHalf: toPlan(PAPER_MM.tickHalf, scale),
    textOffset: toPlan(PAPER_MM.textOffset, scale),
    bubbleRadius: toPlan(PAPER_MM.bubbleRadius, scale),
    bubbleOffset: toPlan(PAPER_MM.bubbleOffset, scale),
  };
}

export type DimensionSide = "top" | "left";

export type DerivedAnnotations = {
  readonly paths: readonly PlanPath[];
  readonly labels: readonly PlanLabel[];
};

function dedupe(values: readonly number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  for (const value of sorted) {
    if (out.length === 0 || Math.abs(value - out[out.length - 1]!) > STATION_TOLERANCE_M) {
      out.push(value);
    }
  }
  return out;
}

/**
 * Stations to dimension to, along each axis.
 *
 * Walls running along an axis contribute their *position on the other* axis:
 * a north–south wall is a vertical line on the plan, so it is an x station.
 */
export function dimensionStations(
  walls: readonly SceneNodeLike[],
  bounds: PlanBounds,
): { x: number[]; y: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];

  for (const wall of walls) {
    if (!wall.start || !wall.end) continue;
    const [sx, sy] = wall.start;
    const [ex, ey] = wall.end;
    const dx = Math.abs(ex - sx);
    const dy = Math.abs(ey - sy);
    if (dx < AXIS_TOLERANCE && dy > AXIS_TOLERANCE) {
      xs.push((sx + ex) / 2); // north–south wall → an x station
    } else if (dy < AXIS_TOLERANCE && dx > AXIS_TOLERANCE) {
      ys.push((sy + ey) / 2); // east–west wall → a y station
    }
  }

  /*
   * Dimension to wall *centrelines*, which is what the reference set does: its
   * A→F chain reads 3823 + 3808 + 3808 + 3808 + 3845 = 19092, the building's
   * centreline width, not its outer face.
   *
   * Mixing conventions is what makes a drawing wrong in a way that survives
   * review: seeding the chain from the mitred outer bounds instead would add
   * half a wall thickness to the end bays and print a spurious sliver at each
   * edge. The outer bounds are only a fallback for a plan with too few
   * axis-aligned walls to form a chain at all.
   */
  return {
    x: dedupe(xs.length >= 2 ? xs : [bounds.minX, bounds.maxX]),
    y: dedupe(ys.length >= 2 ? ys : [bounds.minY, bounds.maxY]),
  };
}

/** The 45° slash the reference uses in place of an arrowhead. */
function tick(at: PlanPoint, tickHalf: number): PlanPath {
  const h = tickHalf;
  return {
    points: [
      [at[0] - h, at[1] - h],
      [at[0] + h, at[1] + h],
    ],
    stroke: INK.annotation,
    weightMm: PEN.annotation,
  };
}

function dimensionLabel(
  metres: number,
  at: PlanPoint,
  units: UnitDisplay,
  side: DimensionSide,
  geometry: ReturnType<typeof geometryFor>,
): PlanLabel[] {
  const { primary, secondary } = formatDimension(metres, units);
  // Vertical chains read bottom-to-top, as on the reference sheets.
  const rotateDeg = side === "left" ? -90 : undefined;
  // The second line sits inboard of the first, which is a different direction
  // for each chain once the text is turned.
  const gap = geometry.textOffset * 1.6;
  const second: PlanPoint = side === "left" ? [at[0] - gap, at[1]] : [at[0], at[1] - gap];

  const labels: PlanLabel[] = [
    { at, text: primary, sizeMm: TEXT_MM.dimension, align: "center", rotateDeg },
  ];
  if (secondary) {
    labels.push({
      at: second,
      text: secondary,
      sizeMm: TEXT_MM.dimension * 0.85,
      align: "center",
      rotateDeg,
    });
  }
  return labels;
}

/**
 * One chain of dimensions along a run of stations.
 *
 * `axis` is the coordinate the stations vary along; `at` is the fixed
 * coordinate the dimension line sits on. Segments shorter than the tolerance
 * are skipped: a zero-length dimension is noise, not information.
 */
function chain(
  stations: readonly number[],
  at: number,
  side: DimensionSide,
  units: UnitDisplay,
  geometry: ReturnType<typeof geometryFor>,
): DerivedAnnotations {
  const paths: PlanPath[] = [];
  const labels: PlanLabel[] = [];
  if (stations.length < 2) return { paths, labels };

  const point = (station: number, offset: number): PlanPoint =>
    side === "top" ? [station, at + offset] : [at + offset, station];

  // The dimension line runs the full length of the chain.
  paths.push({
    points: [point(stations[0]!, 0), point(stations[stations.length - 1]!, 0)],
    stroke: INK.annotation,
    weightMm: PEN.annotation,
  });

  for (const station of stations) {
    paths.push(tick(point(station, 0), geometry.tickHalf));
  }

  for (let i = 0; i < stations.length - 1; i += 1) {
    const from = stations[i]!;
    const to = stations[i + 1]!;
    const length = to - from;
    if (length < STATION_TOLERANCE_M) continue;
    const mid = (from + to) / 2;
    labels.push(...dimensionLabel(length, point(mid, geometry.textOffset), units, side, geometry));
  }

  return { paths, labels };
}

export type DimensionOptions = {
  readonly units: UnitDisplay;
  /** Lettered and numbered bubbles at each station, as on the reference. */
  readonly gridBubbles?: boolean;
  /** The scale the sheet will be drawn at — paper offsets convert against it. */
  readonly scale: number;
};

/**
 * Both dimension chains plus grid bubbles for one plan.
 *
 * Emits along the top and the left only. The reference sheets dimension all
 * four sides, but a duplicated reading on the opposite side adds no information
 * and doubles the chance of the two disagreeing after an edit.
 */
export function deriveDimensions(
  walls: readonly SceneNodeLike[],
  bounds: PlanBounds,
  options: DimensionOptions,
): DerivedAnnotations {
  const { units, gridBubbles = true, scale } = options;
  const geometry = geometryFor(scale);
  const stations = dimensionStations(walls, bounds);

  const paths: PlanPath[] = [];
  const labels: PlanLabel[] = [];

  const topLine = bounds.maxY + geometry.firstChainOffset;
  const leftLine = bounds.minX - geometry.firstChainOffset;
  const topOverall = topLine + geometry.chainSpacing;
  const leftOverall = leftLine - geometry.chainSpacing;

  // Extension lines carry each station out to the chains.
  for (const x of stations.x) {
    paths.push({
      points: [
        [x, bounds.maxY + geometry.extensionGap],
        [x, topOverall + geometry.extensionOvershoot],
      ],
      stroke: INK.annotation,
      weightMm: PEN.annotation,
    });
  }
  for (const y of stations.y) {
    paths.push({
      points: [
        [bounds.minX - geometry.extensionGap, y],
        [leftOverall - geometry.extensionOvershoot, y],
      ],
      stroke: INK.annotation,
      weightMm: PEN.annotation,
    });
  }

  const running = [
    chain(stations.x, topLine, "top", units, geometry),
    chain(stations.y, leftLine, "left", units, geometry),
  ];
  // The overall chain spans the same end gridlines as the running chain,
  // ignoring the intermediate ones. Measuring it to the outer bounds instead
  // would print an overall that does not equal the sum of its own bays.
  const overall = [
    chain(endpoints(stations.x), topOverall, "top", units, geometry),
    chain(endpoints(stations.y), leftOverall, "left", units, geometry),
  ];

  for (const part of [...running, ...overall]) {
    paths.push(...part.paths);
    labels.push(...part.labels);
  }

  if (gridBubbles) {
    const bubbleY = topOverall + geometry.bubbleOffset;
    stations.x.forEach((x, index) => {
      paths.push(circle([x, bubbleY], geometry.bubbleRadius));
      labels.push({
        at: [x, bubbleY - 0.12],
        text: gridLetter(index),
        sizeMm: TEXT_MM.gridBubble,
        align: "center",
      });
    });

    const bubbleX = leftOverall - geometry.bubbleOffset;
    // Numbered upward, so 1 is at the bottom of the sheet as drawn.
    stations.y.forEach((y, index) => {
      paths.push(circle([bubbleX, y], geometry.bubbleRadius));
      labels.push({
        at: [bubbleX, y - 0.12],
        text: String(index + 1),
        sizeMm: TEXT_MM.gridBubble,
        align: "center",
      });
    });
  }

  return { paths, labels };
}

/** First and last station, the span the overall dimension measures. */
function endpoints(stations: readonly number[]): number[] {
  if (stations.length < 2) return [...stations];
  return [stations[0]!, stations[stations.length - 1]!];
}

/** Grid letters run A, B, … Z, then AA, AB — never running out. */
export function gridLetter(index: number): string {
  let n = index;
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

function circle(centre: PlanPoint, radius: number, segments = 24): PlanPath {
  const points: PlanPoint[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const angle = (Math.PI * 2 * i) / segments;
    points.push([
      centre[0] + Math.cos(angle) * radius,
      centre[1] + Math.sin(angle) * radius,
    ]);
  }
  return { points, stroke: INK.annotation, weightMm: PEN.annotation };
}

/**
 * Paper millimetres the annotation needs beyond the building on each side.
 *
 * Returned in paper units because the sheet engine subtracts it from the
 * viewport *before* choosing a scale. Doing it the other way round is circular:
 * the margin would depend on the scale that depends on the margin.
 */
export function annotationMarginMm(gridBubbles: boolean): number {
  const chains =
    PAPER_MM.firstChainOffset + PAPER_MM.chainSpacing + PAPER_MM.extensionOvershoot;
  return gridBubbles ? chains + PAPER_MM.bubbleOffset + PAPER_MM.bubbleRadius : chains;
}
