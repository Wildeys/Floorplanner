/**
 * The vector vocabulary a sheet is drawn from, plus the narrow view of a scene
 * node the derivation actually reads.
 *
 * Shared so the wall, opening and furniture derivations can each import these
 * without importing one another.
 */

/** A point in plan space, metres, y increasing up the page. */
export type PlanPoint = readonly [number, number];

/** A closed shape: filled, stroked, or both. */
export type PlanPolygon = {
  readonly points: readonly PlanPoint[];
  /** Poché fill, as on a cut wall. Omit for an outline-only shape. */
  readonly fill?: string;
  readonly stroke?: string;
  /** Pen width in millimetres on paper. Never scaled with the drawing. */
  readonly weightMm?: number;
  /**
   * Draw a ruled pattern inside the shape instead of a flat fill — the block
   * masonry convention. Spacing is in paper millimetres, so the pattern keeps
   * its printed density at any scale rather than thinning out as the drawing
   * shrinks.
   */
  readonly hatch?: {
    readonly spacingMm: number;
    readonly angleDeg: number;
    readonly weightMm: number;
    readonly stroke: string;
    /** Cross-hatch by default; set false for a single set of rules. */
    readonly crossed?: boolean;
  };
};

/**
 * How a line is broken up. Patterns are paper millimetres, so a centreline
 * keeps its printed rhythm at any drawing scale.
 */
export type LineType = "solid" | "dashed" | "dash-dot";

/** An open path: jambs, swing arcs, sill lines, dimension strings. */
export type PlanPath = {
  readonly points: readonly PlanPoint[];
  readonly stroke: string;
  readonly weightMm: number;
  /** Shorthand for `lineType: "dashed"`. */
  readonly dashed?: boolean;
  /** Grid lines and centrelines are chain-dash, as the reference draws them. */
  readonly lineType?: LineType;
};

/**
 * A tag drawn around a label: the reference sheets ring their grid letters,
 * box their room names and hexagon their door marks.
 *
 * It is drawn at paint time rather than derived as geometry because its size
 * is a paper dimension that depends on the measured width of the text, and
 * only the renderer has font metrics. Labels paint last, so a tag correctly
 * masks whatever it sits over.
 */
export type LabelShape = "box" | "hexagon" | "circle";

export type PlanLabel = {
  readonly at: PlanPoint;
  readonly text: string;
  /** Cap height on paper in millimetres — a typographic size, never scaled. */
  readonly sizeMm?: number;
  readonly align?: "left" | "center";
  readonly bold?: boolean;
  readonly shape?: LabelShape;
  /** Clearance between the text and its tag, in paper millimetres. */
  readonly padMm?: number;
  /**
   * Rotation in degrees, anticlockwise on the page. Vertical dimension text is
   * turned so it reads along its own chain — which is both the drawing
   * convention and what stops a wide label box running off the sheet.
   */
  readonly rotateDeg?: number;
};

/**
 * Draw order is load-bearing: openings are knocked out of the walls by
 * overpainting, so `polygons` must be emitted before `knockOuts`, and the
 * symbol `paths` after both.
 */
export type PlanDrawing = {
  readonly polygons: readonly PlanPolygon[];
  readonly knockOuts: readonly PlanPolygon[];
  readonly paths: readonly PlanPath[];
  readonly labels: readonly PlanLabel[];
};

export type PlanBounds = {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
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
  readonly visible?: boolean;

  // Wall
  readonly start?: readonly [number, number];
  readonly end?: readonly [number, number];
  readonly thickness?: number;

  // Zone, slab and ceiling boundaries are a point loop. A site boundary is
  // `{ type, points }` instead, and the default scene always has one.
  readonly polygon?:
    | readonly (readonly [number, number])[]
    | {
        readonly type?: string;
        readonly points?: readonly (readonly [number, number])[];
      };

  // Level
  readonly baseElevation?: number;

  // Door / window. `position[0]` is metres from the host wall's start.
  readonly wallId?: string;
  readonly width?: number;
  readonly height?: number;
  readonly mark?: string;
  readonly hingesSide?: string;
  readonly swingDirection?: string;

  // Item (furniture) — world position, size and Y rotation.
  readonly position?: readonly number[];
  /**
   * An item's rotation is a Euler triple and only `[1]` turns it in plan. A
   * column's is a bare number — the same field name, a different shape — so
   * every reader has to narrow before indexing.
   */
  readonly rotation?: readonly number[] | number;
  /**
   * Catalogue-placed items carry no top-level `dimensions`; their size is the
   * asset's dimensions multiplied by `scale`. The plain field is kept for
   * hand-built nodes and fixtures.
   */
  readonly dimensions?: readonly number[];
  readonly scale?: readonly number[];
  readonly asset?: {
    readonly id?: string;
    readonly name?: string;
    readonly dimensions?: readonly number[];
  };

  // Column. Round columns use `radius`; the rest use `width` x `depth`.
  readonly crossSection?: string;
  readonly radius?: number;
  readonly depth?: number;
};

export type SceneNodes = Readonly<Record<string, SceneNodeLike>>;
