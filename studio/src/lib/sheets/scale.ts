/**
 * Architectural scale and page geometry.
 *
 * This is the piece that separates a drawing set from a picture of a model.
 * The pascal editor's own PDF export fits the plan to the page
 * (`fitPlanToBox`), which produces a correct-looking drawing at an arbitrary
 * scale. A council submission needs the opposite: a *declared* scale, where
 * 1:100 means a 10 m wall measures exactly 100 mm on paper and a scale rule
 * laid on the print reads true (REQUIREMENTS.md FR-534, NFR-6).
 *
 * Consequently "the plan does not fit" is a real, reportable condition here
 * rather than something to silently absorb by rescaling. Callers decide
 * whether to step to a coarser scale or a larger sheet; this module never
 * makes that choice implicitly.
 *
 * Units: model geometry is in metres (the pascal floor-plan scene works in
 * level-frame metres). PDF user space is in points, 1/72 inch.
 */

/** PDF user-space units per inch. Fixed by the PDF specification. */
export const POINTS_PER_INCH = 72;

/** Millimetres per inch. Fixed by definition. */
export const MM_PER_INCH = 25.4;

/** PDF points per millimetre — ~2.834645669. */
export const POINTS_PER_MM = POINTS_PER_INCH / MM_PER_INCH;

/** Millimetres per metre. */
export const MM_PER_METRE = 1000;

export function mmToPoints(mm: number): number {
  return mm * POINTS_PER_MM;
}

export function pointsToMm(points: number): number {
  return points / POINTS_PER_MM;
}

/**
 * An architectural scale expressed by its denominator: 100 means 1:100, i.e.
 * one unit on paper represents 100 of the same unit in reality.
 */
export type ScaleDenominator = number;

/** The scales the Maldives profile uses across the reference set. */
export const STANDARD_SCALES = [20, 50, 100, 200, 500] as const;

function assertPositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive finite number, received ${value}`);
  }
}

/**
 * Convert a real-world length in metres to PDF points at a given scale.
 *
 * At 1:100, 10 m → 283.46 pt → 100 mm on paper.
 */
export function metresToPoints(metres: number, scale: ScaleDenominator): number {
  assertPositiveFinite(scale, "scale");
  if (!Number.isFinite(metres)) {
    throw new RangeError(`metres must be finite, received ${metres}`);
  }
  return mmToPoints((metres * MM_PER_METRE) / scale);
}

/** Inverse of {@link metresToPoints}: how much reality a span of points covers. */
export function pointsToMetres(points: number, scale: ScaleDenominator): number {
  assertPositiveFinite(scale, "scale");
  return (pointsToMm(points) * scale) / MM_PER_METRE;
}

/**
 * A rectangle in PDF points.
 *
 * Origin-agnostic: centring works the same whether y grows up or down, so this
 * carries whatever convention the renderer uses. Note PDFKit puts the origin at
 * the page's *top* left with y increasing downward, which is the opposite of
 * the PDF format's own bottom-left origin.
 */
export type BoxPt = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Plan extents in real-world metres. */
export type PlanExtentM = {
  width: number;
  height: number;
};

export type ScaledPlacement = {
  /** Where the plan lands on the page, in points. */
  box: BoxPt;
  /** The scale actually applied. Never silently altered from the request. */
  scale: ScaleDenominator;
  /** False when the plan is larger than the viewport at this scale. */
  fits: boolean;
  /**
   * How far the plan exceeds the viewport, in points. Zero on each axis that
   * fits. Non-zero values are the caller's signal to pick a coarser scale or a
   * larger sheet — the placement is still returned, centred and overflowing,
   * so it can be rendered for diagnosis.
   */
  overflow: { width: number; height: number };
};

/**
 * Place a plan inside a viewport at a fixed scale, centred.
 *
 * Unlike a fit-to-page placement, the returned size depends only on the plan's
 * real dimensions and the scale — never on the viewport. The viewport only
 * decides position, and whether it fits.
 */
export function placePlanAtScale(
  plan: PlanExtentM,
  viewport: BoxPt,
  scale: ScaleDenominator,
): ScaledPlacement {
  assertPositiveFinite(plan.width, "plan.width");
  assertPositiveFinite(plan.height, "plan.height");
  assertPositiveFinite(scale, "scale");

  const width = metresToPoints(plan.width, scale);
  const height = metresToPoints(plan.height, scale);

  const overflow = {
    width: Math.max(0, width - viewport.width),
    height: Math.max(0, height - viewport.height),
  };

  return {
    box: {
      x: viewport.x + (viewport.width - width) / 2,
      y: viewport.y + (viewport.height - height) / 2,
      width,
      height,
    },
    scale,
    fits: overflow.width === 0 && overflow.height === 0,
    overflow,
  };
}

/**
 * The finest standard scale at which the plan still fits the viewport.
 *
 * Returns null when even the coarsest candidate overflows, so the caller has to
 * choose a larger sheet rather than receive a silently unusable drawing.
 * Candidates are tried finest-first because a larger drawing is more legible.
 */
export function chooseScaleThatFits(
  plan: PlanExtentM,
  viewport: BoxPt,
  candidates: readonly ScaleDenominator[] = STANDARD_SCALES,
): ScaleDenominator | null {
  const ordered = [...candidates].sort((a, b) => a - b);
  for (const scale of ordered) {
    if (placePlanAtScale(plan, viewport, scale).fits) return scale;
  }
  return null;
}

/** Page sizes in millimetres, portrait (width × height). */
const PAGE_SIZES_MM = {
  A4: [210, 297],
  A3: [297, 420],
  A2: [420, 594],
  A1: [594, 841],
} as const satisfies Record<string, readonly [number, number]>;

export type PageSizeName = keyof typeof PAGE_SIZES_MM;
export type Orientation = "portrait" | "landscape";

/**
 * A page size in PDF points, as pdfkit's `size` option wants it.
 */
export function pageSizePoints(
  name: PageSizeName,
  orientation: Orientation = "portrait",
): [number, number] {
  const [shortSide, longSide] = PAGE_SIZES_MM[name];
  const [widthMm, heightMm] =
    orientation === "portrait" ? [shortSide, longSide] : [longSide, shortSide];
  return [mmToPoints(widthMm), mmToPoints(heightMm)];
}

export function pageSizeMm(
  name: PageSizeName,
  orientation: Orientation = "portrait",
): [number, number] {
  const [shortSide, longSide] = PAGE_SIZES_MM[name];
  return orientation === "portrait" ? [shortSide, longSide] : [longSide, shortSide];
}
