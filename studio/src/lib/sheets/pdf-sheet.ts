/**
 * Minimal true-scale sheet emission.
 *
 * The seed of the sheet-composition engine: it places plan geometry on a page
 * at a *declared* architectural scale and emits native PDF vectors. There is no
 * title block or stamp reserve here yet — this exists to prove the measurement
 * claim end to end (REQUIREMENTS.md FR-534 / NFR-6), because that is the one
 * assumption everything else in M2 rests on.
 *
 * Coordinates: plan geometry arrives in level-frame metres with y increasing
 * "up" the plan, matching how a person reads a drawing. PDFKit's page space has
 * its origin at the top left with y increasing downward, so the y axis is
 * flipped during projection. Getting this wrong mirrors the drawing without
 * changing any measured length, which is exactly the sort of bug a pure unit
 * test would miss — hence the orientation assertion in the accompanying tests.
 */

import {
  type BoxPt,
  mmToPoints,
  type Orientation,
  type PageSizeName,
  pageSizePoints,
  type PlanExtentM,
  placePlanAtScale,
  type ScaleDenominator,
  type ScaledPlacement,
} from "./scale.ts";

/** A point in plan space, in metres: [x, y] with y up. */
export type PlanPointM = readonly [number, number];

export type PlanSegmentM = {
  readonly from: PlanPointM;
  readonly to: PlanPointM;
  /** Stroke width in millimetres *on paper* — a CAD line weight, not a scaled length. */
  readonly weightMm?: number;
};

export type SheetSpec = {
  readonly page: PageSizeName;
  readonly orientation?: Orientation;
  /** Uniform page margin in millimetres, defining the drawing viewport. */
  readonly marginMm?: number;
  readonly scale: ScaleDenominator;
  /** Real extents of the plan being drawn. */
  readonly plan: PlanExtentM;
  /**
   * Geometry in plan metres, expressed relative to the plan's lower-left
   * corner (so a segment at [0,0] sits at the corner of `plan`).
   */
  readonly segments: readonly PlanSegmentM[];
};

export type SheetRenderResult = {
  readonly pdf: Buffer;
  readonly placement: ScaledPlacement;
  readonly pageSize: readonly [number, number];
};

const DEFAULT_MARGIN_MM = 12;
const DEFAULT_LINE_WEIGHT_MM = 0.35;

/**
 * Project a plan-space point (metres, y up, relative to the plan's lower-left)
 * into PDFKit page space (points, y down, page top-left origin).
 */
export function projectPlanPoint(
  point: PlanPointM,
  placement: ScaledPlacement,
): [number, number] {
  const [xM, yM] = point;
  const scaled = (metres: number) => mmToPoints((metres * 1000) / placement.scale);
  return [
    placement.box.x + scaled(xM),
    // Flip: plan y grows up, page y grows down.
    placement.box.y + placement.box.height - scaled(yM),
  ];
}

export function sheetViewport(
  pageSize: readonly [number, number],
  marginMm: number,
): BoxPt {
  const margin = mmToPoints(marginMm);
  return {
    x: margin,
    y: margin,
    width: pageSize[0] - margin * 2,
    height: pageSize[1] - margin * 2,
  };
}

/**
 * A pdfkit document sized in points.
 *
 * `compress` is left off so the emitted content stream stays inspectable: the
 * verification tests read the path operators back and measure them, which is
 * the only way to prove the output — rather than our arithmetic — is to scale.
 *
 * Shared with the multi-sheet path in sheet-set.ts so both produce structurally
 * identical PDFs — the spike stays a genuine regression guard for the real one.
 */
export async function createPdfDocument(
  pageSize: readonly [number, number],
): Promise<{ doc: PdfDoc; done: Promise<Buffer> }> {
  // The standalone build, not the default entry point: pdfkit's Node build
  // imports `fs`, which cannot resolve in a browser bundle. The standalone
  // bundle ships a virtual filesystem and its own font data, and works
  // unchanged under Node — so both the browser and the tests take one code
  // path rather than diverging on environment.
  const pdfkit = await import("pdfkit/js/pdfkit.standalone.js");
  const PDFDocument = ((pdfkit as { default?: unknown }).default ??
    pdfkit) as new (options: Record<string, unknown>) => PdfDoc;

  const doc = new PDFDocument({
    size: [pageSize[0], pageSize[1]],
    margin: 0,
    compress: false,
    autoFirstPage: true,
  });

  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  return { doc, done };
}

/** The slice of pdfkit's surface the sheet engine uses. */
export type PdfDoc = {
  moveTo(x: number, y: number): PdfDoc;
  lineTo(x: number, y: number): PdfDoc;
  rect(x: number, y: number, w: number, h: number): PdfDoc;
  closePath(): PdfDoc;
  clip(): PdfDoc;
  lineWidth(w: number): PdfDoc;
  dash(length: number, options?: { space?: number }): PdfDoc;
  undash(): PdfDoc;
  stroke(color?: string): PdfDoc;
  fill(color?: string): PdfDoc;
  fillAndStroke(fillColor?: string, strokeColor?: string): PdfDoc;
  font(name: string): PdfDoc;
  fontSize(size: number): PdfDoc;
  fillColor(color: string, opacity?: number): PdfDoc;
  text(text: string, x: number, y: number, options?: Record<string, unknown>): PdfDoc;
  save(): PdfDoc;
  restore(): PdfDoc;
  rotate(angle: number, options?: { origin?: [number, number] }): PdfDoc;
  addPage(options?: Record<string, unknown>): PdfDoc;
  widthOfString(text: string): number;
  on(event: string, handler: (arg: never) => void): PdfDoc;
  end(): void;
};

/** Render a single-page sheet at a declared scale and return the PDF bytes. */
export async function renderSheetToPdf(spec: SheetSpec): Promise<SheetRenderResult> {
  const orientation = spec.orientation ?? "portrait";
  const marginMm = spec.marginMm ?? DEFAULT_MARGIN_MM;
  const pageSize = pageSizePoints(spec.page, orientation);
  const viewport = sheetViewport(pageSize, marginMm);
  const placement = placePlanAtScale(spec.plan, viewport, spec.scale);

  const { doc, done } = await createPdfDocument(pageSize);

  for (const segment of spec.segments) {
    const [x1, y1] = projectPlanPoint(segment.from, placement);
    const [x2, y2] = projectPlanPoint(segment.to, placement);
    doc
      .moveTo(x1, y1)
      .lineTo(x2, y2)
      .lineWidth(mmToPoints(segment.weightMm ?? DEFAULT_LINE_WEIGHT_MM))
      .stroke("#000000");
  }

  doc.end();
  const pdf = await done;

  return { pdf, placement, pageSize };
}
