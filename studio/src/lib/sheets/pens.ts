/**
 * Line weights and fills — the drawing's pen table.
 *
 * Architectural drawings read by line weight before anything else: what the
 * section plane cuts is heavy, what it merely sees is light, and annotation is
 * lighter still. The reference set in `samplephotos/` follows that hierarchy,
 * so the values here are named by *role* rather than by number. A symbol drawn
 * with the wrong pen is legible but wrong — it tells the reader the building is
 * something it is not.
 *
 * All widths are millimetres **on paper**: a 0.5 mm pen stays 0.5 mm whether
 * the sheet is 1:50 or 1:200. They are never scaled with the drawing.
 */

export const PEN = {
  /** Outline of anything the plan cuts through — walls, columns. Heaviest. */
  cut: 0.5,
  /** Jambs and sills: the reveal faces of an opening in a cut wall. */
  opening: 0.35,
  /** Things seen below the cut plane — furniture, fixtures, stairs. */
  seen: 0.25,
  /** Door swings, sill lines, symbol interiors. */
  symbol: 0.18,
  /** Dimension lines, extension lines, leaders, grid lines. */
  annotation: 0.13,
} as const;

export const INK = {
  /** Cut poché. At 1:100 the reference set's block masonry reads as solid. */
  poche: "#1a1a1a",
  line: "#1a1a1a",
  /**
   * Openings are knocked out of the wall by overdrawing in the sheet colour
   * rather than by subtracting geometry. A boolean subtraction against mitred
   * wall outlines would be far more code and far more ways to be subtly wrong,
   * and on an opaque sheet the result is identical.
   */
  paper: "#ffffff",
  annotation: "#1a1a1a",
} as const;

/** Text sizes on paper, millimetres (DESIGN.md §3.5 / reference sheets). */
export const TEXT_MM = {
  roomName: 2.2,
  roomArea: 1.8,
  openingMark: 1.6,
  dimension: 1.8,
  gridBubble: 2.4,
} as const;

/**
 * Block masonry, as the reference legend labels it.
 *
 * Spacing is a paper dimension so the pattern keeps its density at any scale.
 * Note this is *not* what the reference prints on a 1:100 plan — there the
 * walls read solid, and the ruled pattern appears on the 1:20 details. Use it
 * where it is legible, not everywhere.
 */
export const MASONRY_HATCH = {
  spacingMm: 0.8,
  angleDeg: 45,
  weightMm: 0.13,
  stroke: "#1a1a1a",
} as const;
