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
};

/** An open path: jambs, swing arcs, sill lines, dimension strings. */
export type PlanPath = {
  readonly points: readonly PlanPoint[];
  readonly stroke: string;
  readonly weightMm: number;
  /** Chain-dash, for grid lines and centrelines. */
  readonly dashed?: boolean;
};

export type PlanLabel = {
  readonly at: PlanPoint;
  readonly text: string;
  /** Cap height on paper in millimetres — a typographic size, never scaled. */
  readonly sizeMm?: number;
  readonly align?: "left" | "center";
  readonly bold?: boolean;
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

  // Zone
  readonly polygon?: readonly (readonly [number, number])[];

  // Level
  readonly baseElevation?: number;

  // Door / window. `position[0]` is metres from the host wall's start.
  readonly wallId?: string;
  readonly width?: number;
  readonly mark?: string;
  readonly hingesSide?: string;
  readonly swingDirection?: string;

  // Item (furniture) — world position, size and Y rotation.
  readonly position?: readonly number[];
  readonly dimensions?: readonly number[];
  readonly rotation?: readonly number[];
};

export type SceneNodes = Readonly<Record<string, SceneNodeLike>>;
