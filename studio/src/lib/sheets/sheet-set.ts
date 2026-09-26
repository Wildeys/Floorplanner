/**
 * Sheet composition — the multi-page architectural set
 * (REQUIREMENTS.md FR-502, FR-520 … FR-522, FR-531, FR-533).
 *
 * Takes derived plan geometry plus a jurisdiction profile and emits one
 * multi-page PDF: each storey a sheet, drawn at a declared architectural scale,
 * with the title block and council stamp reserve the profile specifies.
 *
 * Two rules hold everything else together:
 *
 *  - **Scale is declared, never fitted.** If a plan does not fit its viewport
 *    at the requested scale, the sheet steps to the next coarser standard scale
 *    and says so in the scale note. It never silently rescales to fill the page,
 *    because then the printed drawing would not measure true (FR-534).
 *  - **Nothing intrudes on the stamp reserve.** The drawing viewport is
 *    computed to exclude it, so the council's stamp always has clear paper.
 */

import {
  type DerivedLevel,
  type PlanDrawing,
  type PlanPoint,
  boundsExtent,
} from "./derive-plan.ts";
import {
  formatDimension,
  type JurisdictionProfile,
  type ProjectMetadata,
  type TitleBlockField,
  sheetCodeAt,
} from "./jurisdiction.ts";
import { createPdfDocument, type PdfDoc } from "./pdf-sheet.ts";
import {
  type BoxPt,
  mmToPoints,
  pageSizePoints,
  placePlanAtScale,
  pointsToMm,
  type ScaleDenominator,
  STANDARD_SCALES,
} from "./scale.ts";

const INK = "#111111";
const HAIRLINE = "#888888";
const WATERMARK = "#c8c8c8";

export type SheetSetOptions = {
  readonly profile: JurisdictionProfile;
  readonly project: ProjectMetadata;
  readonly levels: readonly DerivedLevel[];
  /**
   * Stamped diagonally across every page. A preview produced before payment and
   * architect release must carry one (FR-531); a released set passes null.
   */
  readonly watermark?: string | null;
};

export type EmittedSheet = {
  readonly code: string;
  readonly title: string;
  readonly scale: ScaleDenominator;
  /** True when the plan fitted at the profile's default scale. */
  readonly atDefaultScale: boolean;
  readonly planWidthMm: number;
  readonly planHeightMm: number;
};

export type SheetSetResult = {
  readonly pdf: Buffer;
  readonly sheets: readonly EmittedSheet[];
};

/** Page-space helpers. PDFKit's origin is top-left with y increasing downward. */
type Page = {
  readonly widthPt: number;
  readonly heightPt: number;
};

function mm(value: number): number {
  return mmToPoints(value);
}

/**
 * The area left for the drawing once the margin, the title-block band and the
 * stamp reserve are taken out.
 *
 * The reserve sits at the lower left, so it is excluded by lifting the
 * viewport's bottom edge rather than by narrowing it — narrowing would waste
 * the full height of the sheet for a 51 mm square.
 */
export function drawingViewport(profile: JurisdictionProfile, page: Page): BoxPt {
  const margin = mm(profile.marginMm);
  const titleBlock = mm(profile.titleBlockWidthMm);
  const reserveTop =
    mm(profile.stampReserve.offsetMm) + mm(profile.stampReserve.sizeMm) + mm(4);

  const x = margin;
  const y = margin;
  const width = page.widthPt - margin - titleBlock - margin;
  const height = page.heightPt - margin - reserveTop;

  return { x, y, width: Math.max(width, 1), height: Math.max(height, 1) };
}

/**
 * Pick the scale to draw at: the requested one when it fits, otherwise the next
 * coarser standard scale that does.
 *
 * Returns the requested scale even when nothing fits, so the sheet is still
 * emitted and the overflow is visible rather than the set silently losing a
 * storey.
 */
export function resolveSheetScale(
  planWidthM: number,
  planHeightM: number,
  viewport: BoxPt,
  requested: ScaleDenominator,
): { scale: ScaleDenominator; atRequested: boolean } {
  const plan = { width: planWidthM, height: planHeightM };
  if (placePlanAtScale(plan, viewport, requested).fits) {
    return { scale: requested, atRequested: true };
  }
  for (const candidate of STANDARD_SCALES) {
    if (candidate <= requested) continue;
    if (placePlanAtScale(plan, viewport, candidate).fits) {
      return { scale: candidate, atRequested: false };
    }
  }
  return { scale: requested, atRequested: false };
}

function drawStampReserve(doc: PdfDoc, profile: JurisdictionProfile, page: Page): void {
  const size = mm(profile.stampReserve.sizeMm);
  const offset = mm(profile.stampReserve.offsetMm);
  const x = offset;
  const y = page.heightPt - offset - size;

  doc
    .save()
    .dash(mm(1.5), { space: mm(1) })
    .lineWidth(mm(0.2))
    .rect(x, y, size, size)
    .stroke(HAIRLINE)
    .undash();

  doc
    .font("Helvetica")
    .fontSize(mm(1.4))
    .fillColor(INK)
    .text(profile.stampReserve.caption, x, y + size + mm(1.5), {
      width: size + mm(20),
      lineGap: mm(0.3),
    });

  doc.restore();
}

function titleBlockValue(
  field: TitleBlockField,
  project: ProjectMetadata,
  sheet: { code: string; title: string; scale: ScaleDenominator },
): string {
  switch (field.id) {
    case "projectName":
      return project.projectName;
    case "drawingTitle":
      return sheet.title;
    case "client":
      return project.client ?? "";
    case "date":
      return project.date ?? "";
    case "projectNo":
      return project.projectNo ?? "-";
    case "firmName":
      return project.firmName ?? "";
    case "firmDiscipline":
      return project.firmDiscipline ?? "";
    case "contactNo":
      return project.contactNo ?? "";
    case "email":
      return project.email ?? "";
    case "scale":
      return `1:${sheet.scale}`;
    case "drawingNo":
      return "-";
    // The four personnel fields stay blank until a human signs them (FR-520).
    case "architect":
      return project.architect ?? "";
    case "architecturalChecker":
      return project.architecturalChecker ?? "";
    case "engineer":
      return project.engineer ?? "";
    case "structuralChecker":
      return project.structuralChecker ?? "";
  }
}

function drawTitleBlock(
  doc: PdfDoc,
  profile: JurisdictionProfile,
  project: ProjectMetadata,
  page: Page,
  sheet: { code: string; title: string; scale: ScaleDenominator },
): void {
  const margin = mm(profile.marginMm);
  const width = mm(profile.titleBlockWidthMm);
  const x = page.widthPt - margin - width;
  const top = margin;
  const height = page.heightPt - margin * 2;

  doc.save();
  doc.rect(x, top, width, height).lineWidth(mm(0.3)).stroke(HAIRLINE);

  let cursor = top + mm(6);
  const pad = mm(3);
  const innerWidth = width - pad * 2;

  for (const field of profile.titleBlockFields) {
    const value = titleBlockValue(field, project, sheet);
    if (field.label) {
      doc
        .font("Helvetica")
        .fontSize(mm(1.5))
        .fillColor(HAIRLINE)
        .text(field.label, x + pad, cursor, { width: innerWidth });
      cursor += mm(2.4);
    }

    doc
      .font(field.signedByHuman ? "Helvetica-Oblique" : "Helvetica")
      .fontSize(mm(2.1))
      .fillColor(INK)
      .text(value || " ", x + pad, cursor, { width: innerWidth });
    cursor += mm(4.6);

    // A blank personnel field is meaningful, not an oversight: it is where the
    // reviewing architect or engineer signs. Make it visibly a ruled blank.
    if (field.signedByHuman && !value) {
      doc
        .moveTo(x + pad, cursor - mm(1.4))
        .lineTo(x + pad + innerWidth * 0.8, cursor - mm(1.4))
        .lineWidth(mm(0.15))
        .stroke(HAIRLINE);
    }
  }

  // Sheet number, set large at the foot of the block as on the reference set.
  doc
    .font("Helvetica")
    .fontSize(mm(3))
    .fillColor(HAIRLINE)
    .text("SHEET NO:", x + pad, page.heightPt - margin - mm(22), { width: innerWidth });
  doc
    .font("Helvetica-Bold")
    .fontSize(mm(11))
    .fillColor(INK)
    .text(sheet.code, x + pad, page.heightPt - margin - mm(18), {
      width: innerWidth,
      align: "right",
    });

  doc.restore();
}

/** Plan metres → page points, given a placement and the plan's own origin. */
function projector(
  placement: ReturnType<typeof placePlanAtScale>,
  originX: number,
  originY: number,
) {
  const toPt = (metres: number) => mm((metres * 1000) / placement.scale);
  return ([x, y]: PlanPoint): [number, number] => [
    placement.box.x + toPt(x - originX),
    // Plan y grows up the page; PDFKit's grows down.
    placement.box.y + placement.box.height - toPt(y - originY),
  ];
}

function drawPlan(
  doc: PdfDoc,
  drawing: PlanDrawing,
  placement: ReturnType<typeof placePlanAtScale>,
  originX: number,
  originY: number,
): void {
  const project = projector(placement, originX, originY);

  doc.save();
  for (const polygon of drawing.polygons) {
    if (polygon.points.length < 3) continue;
    const [first, ...rest] = polygon.points.map(project);
    doc.moveTo(first![0], first![1]);
    for (const [px, py] of rest) doc.lineTo(px, py);
    doc.closePath().lineWidth(mm(polygon.weightMm ?? 0.25));

    if (polygon.fill && polygon.stroke) {
      doc.fillAndStroke(polygon.fill, polygon.stroke);
    } else if (polygon.fill) {
      doc.fill(polygon.fill);
    } else {
      doc.stroke(polygon.stroke ?? INK);
    }
  }
  doc.restore();

  doc.save();
  for (const label of drawing.labels) {
    const [px, py] = project(label.at);
    const size = mm(label.sizeMm ?? 2);
    const boxWidth = mm(40);
    doc
      .font(label.bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(size)
      .fillColor(INK)
      .text(label.text, px - boxWidth / 2, py - size / 2, {
        width: boxWidth,
        align: label.align ?? "center",
      });
  }
  doc.restore();
}

function drawNorthArrow(doc: PdfDoc, x: number, y: number): void {
  const r = mm(5);
  doc
    .save()
    .moveTo(x, y - r)
    .lineTo(x + r * 0.5, y + r * 0.6)
    .lineTo(x, y + r * 0.25)
    .lineTo(x - r * 0.5, y + r * 0.6)
    .closePath()
    .fillAndStroke(INK, INK);
  doc
    .font("Helvetica-Bold")
    .fontSize(mm(2.6))
    .fillColor(INK)
    .text("N", x - mm(2), y + r * 0.9, { width: mm(4), align: "center" });
  doc.restore();
}

function drawSheetCaption(
  doc: PdfDoc,
  viewport: BoxPt,
  title: string,
  scale: ScaleDenominator,
  atRequested: boolean,
): void {
  const baseline = viewport.y + viewport.height - mm(8);
  doc.save();
  doc
    .font("Helvetica-Bold")
    .fontSize(mm(3.4))
    .fillColor(INK)
    .text(title, viewport.x + mm(4), baseline, { width: viewport.width });
  doc
    .font("Helvetica")
    .fontSize(mm(2))
    .fillColor(INK)
    .text(
      atRequested ? `SCALE 1:${scale}` : `SCALE 1:${scale} (reduced to fit sheet)`,
      viewport.x + mm(4),
      baseline + mm(4),
      { width: viewport.width },
    );
  doc.restore();
}

function drawWatermark(doc: PdfDoc, page: Page, text: string): void {
  doc.save();
  doc.rotate(-32, { origin: [page.widthPt / 2, page.heightPt / 2] });
  doc
    .font("Helvetica-Bold")
    .fontSize(mm(22))
    .fillColor(WATERMARK, 0.45)
    .text(text, 0, page.heightPt / 2 - mm(12), {
      width: page.widthPt,
      align: "center",
    });
  doc.restore();
}

/**
 * Compose and emit the architectural sheet set.
 */
export async function renderSheetSet(options: SheetSetOptions): Promise<SheetSetResult> {
  const { profile, project, levels, watermark = null } = options;
  if (levels.length === 0) {
    throw new Error("Cannot produce a drawing set: the model has no levels with geometry.");
  }

  const pageSize = pageSizePoints(profile.page, profile.orientation);
  const page: Page = { widthPt: pageSize[0], heightPt: pageSize[1] };
  const viewport = drawingViewport(profile, page);

  const { doc, done } = await createPdfDocument(pageSize);
  const emitted: EmittedSheet[] = [];

  const planSheet = profile.sheets.find((s) => s.repeat === "per-level");
  const baseCode = planSheet?.code ?? "A.01";
  const requestedScale = planSheet?.scale ?? profile.defaultPlanScale;

  levels.forEach((level, index) => {
    if (index > 0) doc.addPage({ size: [pageSize[0], pageSize[1]], margin: 0 });

    const extent = boundsExtent(level.bounds);
    const { scale, atRequested } = resolveSheetScale(
      extent.width,
      extent.height,
      viewport,
      requestedScale,
    );
    const placement = placePlanAtScale(
      { width: extent.width, height: extent.height },
      viewport,
      scale,
    );

    const title = `${level.name.toUpperCase()} FLOOR PLAN`;
    const code = sheetCodeAt(
      planSheet ?? { code: baseCode, title, scale, repeat: "per-level" },
      index,
    );

    drawPlan(doc, level.drawing, placement, level.bounds.minX, level.bounds.minY);
    drawSheetCaption(doc, viewport, title, scale, atRequested);
    drawNorthArrow(doc, viewport.x + viewport.width - mm(12), viewport.y + mm(12));
    drawStampReserve(doc, profile, page);
    drawTitleBlock(doc, profile, project, page, { code, title, scale });
    if (watermark) drawWatermark(doc, page, watermark);

    emitted.push({
      code,
      title,
      scale,
      atDefaultScale: atRequested,
      planWidthMm: pointsToMm(placement.box.width),
      planHeightMm: pointsToMm(placement.box.height),
    });
  });

  doc.end();
  return { pdf: await done, sheets: emitted };
}

/** A dimension string as the profile prints it, for callers building labels. */
export function dimensionLabel(metres: number, profile: JurisdictionProfile): string {
  const { primary, secondary } = formatDimension(metres, profile.units);
  return secondary ? `${primary}\n${secondary}` : primary;
}
