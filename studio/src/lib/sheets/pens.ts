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
 * This *is* what the reference prints on its 1:100 plans: sheet A.02 cross-
 * hatches every block wall and carries a matching swatch in its legend,
 * reserving solid black for the columns. An earlier note here claimed the
 * opposite; it was wrong, and the sheets drew every wall solid because of it.
 *
 * Spacing is a paper dimension so the pattern keeps its printed density at any
 * scale. 1.1 mm is read off the reference: fine enough to register as masonry
 * on a 2 mm wall, coarse enough not to fill in to solid grey when printed.
 */
export const MASONRY_HATCH = {
  spacingMm: 1.1,
  angleDeg: 45,
  weightMm: 0.13,
  stroke: "#1a1a1a",
} as const;

/** Columns are the one thing the reference fills solid. */
export const COLUMN_FILL = INK.poche;
