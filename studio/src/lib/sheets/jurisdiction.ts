/**
 * Jurisdiction profiles (REQUIREMENTS.md FR-60 … FR-64).
 *
 * Everything market-specific about a sheet lives here as data: page size,
 * title-block layout and field list, the council stamp reserve, sheet codes,
 * default scales and unit display. The composition engine reads this and knows
 * nothing about the Maldives, so adding a second market is a new profile object
 * rather than a change to the renderer (FR-63).
 *
 * The Maldives profile is measured off the ARTEFACT "Everglow" reference set in
 * `samplephotos/`: a right-hand title block, a dashed 2-inch square stamp
 * reserve at the lower left, and dual millimetre / foot-inch dimensions.
 */

import type { Orientation, PageSizeName, ScaleDenominator } from "./scale.ts";

/** A field printed in the title block. `value` is resolved per project. */
export type TitleBlockFieldId =
  | "projectName"
  | "drawingTitle"
  | "architect"
  | "architecturalChecker"
  | "engineer"
  | "structuralChecker"
  | "client"
  | "date"
  | "firmName"
  | "firmDiscipline"
  | "contactNo"
  | "email"
  | "projectNo"
  | "scale"
  | "drawingNo";

export type TitleBlockField = {
  readonly id: TitleBlockFieldId;
  /** Small caps label printed above the value, as on the reference sheets. */
  readonly label: string;
  /**
   * True for the four personnel fields, which stay blank until a human signs
   * them: architect + checker at QA release, engineer + structural checker on
   * structural upload (FR-520, FR-Q3, FR-83).
   */
  readonly signedByHuman?: boolean;
};

export type StampReserve = {
  /** Side length in millimetres. The reference set reserves 2 inches square. */
  readonly sizeMm: number;
  /** Offset from the page's lower-left corner, in millimetres. */
  readonly offsetMm: number;
  readonly caption: string;
};

export type SheetDefinition = {
  readonly code: string;
  readonly title: string;
  readonly scale: ScaleDenominator;
  /**
   * `per-level` emits one sheet per storey, numbering upward from `code`.
   * `single` emits exactly one.
   */
  readonly repeat: "per-level" | "single";
};

export type UnitDisplay = {
  /** Primary unit printed on dimension strings. */
  readonly primary: "mm";
  /**
   * When set, a bracketed secondary reading is printed beneath the primary —
   * the reference set shows `[63'-4"]` under `19292` (FR-62).
   */
  readonly secondary: "ft-in" | null;
};

/**
 * A row in the sheet's legend block.
 *
 * `swatch` says how the sample square is drawn: a mark is the tag itself
 * (PD, ED), `hatch` reproduces the masonry pattern, `solid` a filled square.
 */
export type LegendEntry = {
  readonly mark?: string;
  readonly swatch?: "hatch" | "solid";
  readonly label: string;
};

/**
 * The blocks that sit beside the drawing on every plan sheet.
 *
 * These barely change between projects, so they are profile content rather
 * than code: a second jurisdiction supplies its own wording and the
 * composition engine is untouched (FR-60, FR-63). Finish lines may carry
 * `{floorFinish}` and `{wallTile}`, substituted from the project.
 */
export type PlanSheetBlocks = {
  readonly legendTitle: string;
  readonly legend: readonly LegendEntry[];
  readonly notesTitle: string;
  readonly notes: readonly string[];
};

export type JurisdictionProfile = {
  readonly id: string;
  readonly name: string;
  readonly page: PageSizeName;
  readonly orientation: Orientation;
  /** Outer page margin in millimetres. */
  readonly marginMm: number;
  /** Title-block band width in millimetres, measured from the right edge. */
  readonly titleBlockWidthMm: number;
  readonly titleBlockFields: readonly TitleBlockField[];
  readonly stampReserve: StampReserve;
  readonly units: UnitDisplay;
  /** The scale plans are drawn at when the building suits it. */
  readonly defaultPlanScale: ScaleDenominator;
  /**
   * The finest scale a *plan* may be enlarged to when the building is small
   * enough to leave the sheet mostly empty. Plans are conventionally 1:100;
   * 1:50 is still a plan, while 1:20 reads as a detail.
   */
  readonly finestPlanScale: ScaleDenominator;
  readonly sheets: readonly SheetDefinition[];
  /** Legend and finishing-notes blocks printed on each plan sheet. */
  readonly planBlocks?: PlanSheetBlocks;
};

/** Inches to millimetres — the stamp reserve is specified in inches. */
const INCH_MM = 25.4;

export const MALDIVES_PROFILE: JurisdictionProfile = {
  id: "mv-council",
  name: "Maldives council submission",
  page: "A3",
  orientation: "landscape",
  marginMm: 10,
  titleBlockWidthMm: 62,
  titleBlockFields: [
    { id: "projectName", label: "PROJECT NAME:" },
    { id: "drawingTitle", label: "DRAWING TITLE:" },
    { id: "architect", label: "ARCHITECT:", signedByHuman: true },
    { id: "architecturalChecker", label: "ARCHITECTURAL CHECKER:", signedByHuman: true },
    { id: "engineer", label: "ENGINEER:", signedByHuman: true },
    { id: "structuralChecker", label: "STRUCTURAL CHECKER:", signedByHuman: true },
    { id: "client", label: "CLIENT:" },
    { id: "date", label: "DATE:" },
    { id: "firmName", label: "ARCHITECTURAL FIRM NAME:" },
    { id: "firmDiscipline", label: "" },
    { id: "contactNo", label: "CONTACT NO:" },
    { id: "email", label: "E-MAIL:" },
    { id: "projectNo", label: "PROJECT NO:" },
    { id: "scale", label: "SCALE:" },
    { id: "drawingNo", label: "DRAWING NO:" },
  ],
  stampReserve: {
    sizeMm: 2 * INCH_MM,
    offsetMm: 10,
    caption:
      "2-INCH X 2 INCH FROM THE BOTTOM LEFT CORNER OF EACH PAGE LEFT FOR COUNCIL STAMP",
  },
  units: { primary: "mm", secondary: "ft-in" },
  defaultPlanScale: 100,
  finestPlanScale: 50,
  sheets: [
    { code: "A.00", title: "SITE PLAN", scale: 200, repeat: "single" },
    { code: "A.01", title: "FLOOR PLAN", scale: 100, repeat: "per-level" },
  ],
  // Transcribed from the reference sheet A.02. The duct marks follow FR-502's
  // PD / ED / ND; the reference's own swatch is lettered FD for the plumbing
  // duct, which looks like a typo on its part and is worth an architect's
  // ruling before the first real submission.
  planBlocks: {
    legendTitle: "LEGEND",
    legend: [
      { mark: "PD", label: "PLUMBING DUCT" },
      { mark: "ED", label: "ELECTRICAL DUCT" },
      { mark: "ND", label: "NETWORKING DUCT" },
      { label: "FLOOR DRAIN" },
      { swatch: "hatch", label: "BLOCK MASONRY WALL" },
    ],
    notesTitle: "FINISHING DETAILS:",
    notes: [
      "FFL OF BALCONIES SHOULD BE 25MM LOWER THAN THE FFL OF RESPECTIVE FLOORS.",
      "WATER PROOFING TO BE APPLIED IN TOILETS, BALCONIES & ROOF TERRACE PRIOR TO TILING.",
      "EXTERNAL WALLS - WHITE STIPPLE EXTERIOR PAINT FINISH.",
      "TOILET WALLS - {wallTile} CERAMIC WALL TILES UP TO CEILING HEIGHT WITH TILE ADHESIVE. USE JOINT FILLER OF APPROPRIATE COLOUR FOR GROUTING JOINTS BETWEEN TILES.",
      "FLOORS - {floorFinish} HOMOGENOUS FLOOR TILES WITH TILE ADHESIVE.",
      "TOILET FLOORS - 300MMX300MM NON SKID CERAMIC FLOOR TILES WITH TILE ADHESIVE.",
      "ALL TOILETS MECHANICALLY VENTILATED.",
    ],
  },
};

export const PROFILES: Record<string, JurisdictionProfile> = {
  [MALDIVES_PROFILE.id]: MALDIVES_PROFILE,
};

export function getProfile(id: string): JurisdictionProfile {
  const profile = PROFILES[id];
  if (!profile) {
    throw new Error(
      `Unknown jurisdiction profile "${id}". Known: ${Object.keys(PROFILES).join(", ")}`,
    );
  }
  return profile;
}

/**
 * Project metadata that populates the title block.
 *
 * The four personnel fields are deliberately optional and default to blank: a
 * generated set carries no name until a human puts one there (FR-520).
 */
export type ProjectMetadata = {
  readonly projectName: string;
  readonly client?: string;
  readonly date?: string;
  readonly projectNo?: string;
  readonly firmName?: string;
  readonly firmDiscipline?: string;
  readonly contactNo?: string;
  readonly email?: string;
  readonly architect?: string;
  readonly architecturalChecker?: string;
  readonly engineer?: string;
  readonly structuralChecker?: string;
  /**
   * Finish selections (FR-36). They feed the `{floorFinish}` / `{wallTile}`
   * placeholders in the profile's finishing notes, and nothing else on a plan
   * — the detail sheets swap their own callouts separately.
   */
  readonly floorFinish?: string;
  readonly wallTile?: string;
};

/**
 * Format millimetres as feet and inches, e.g. 19292 → `[63'-4"]`.
 *
 * Inches are rounded to the nearest whole inch, matching the reference set,
 * and a rounded 12 carries into the feet so `[4'-12"]` can never be printed.
 */
export function formatFeetInches(mm: number): string {
  const totalInches = mm / INCH_MM;
  let feet = Math.floor(totalInches / 12);
  let inches = Math.round(totalInches - feet * 12);
  if (inches === 12) {
    feet += 1;
    inches = 0;
  }
  return `[${feet}'-${inches}"]`;
}

/** A dimension as the reference sheets print it: millimetres over feet-inches. */
export function formatDimension(
  metres: number,
  units: UnitDisplay,
): { primary: string; secondary: string | null } {
  const mm = metres * 1000;
  return {
    primary: String(Math.round(mm)),
    secondary: units.secondary === "ft-in" ? formatFeetInches(mm) : null,
  };
}

/** Sheet code for the nth repeat of a definition: A.01, A.02, A.03… */
export function sheetCodeAt(definition: SheetDefinition, index: number): string {
  if (definition.repeat === "single" || index === 0) return definition.code;
  const match = /^([A-Za-z]+)\.(\d+)$/.exec(definition.code);
  if (!match) return `${definition.code}.${index + 1}`;
  const width = match[2]!.length;
  return `${match[1]}.${String(Number(match[2]) + index).padStart(width, "0")}`;
}
