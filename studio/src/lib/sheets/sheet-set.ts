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

import { annotationMarginMm, deriveDimensions } from "./derive-dimensions.ts";
import {
  type DerivedLevel,
  type PlanBounds,
  type PlanDrawing,
  type PlanPoint,
  type SceneNodes,
  boundsExtent,
  derivePlanLevels,
} from "./derive-plan.ts";
import {
  formatDimension,
  type JurisdictionProfile,
  type ProjectMetadata,
  type TitleBlockField,
  type PlanSheetBlocks,
  sheetCodeAt,
} from "./jurisdiction.ts";
import { createPdfDocument, type PdfDoc } from "./pdf-sheet.ts";
import { MASONRY_HATCH, PEN } from "./pens.ts";
import type { LabelShape, LineType, PlanPolygon } from "./plan-types.ts";
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
const WATERMARK = "#d4d4d4";
/** The sheet colour, for tags that knock out what they sit over. */
const PAPER = "#ffffff";

export type SheetSetOptions = {
  readonly profile: JurisdictionProfile;
  readonly project: ProjectMetadata;
  readonly levels: readonly DerivedLevel[];
  /**
   * Stamped diagonally across every page. A preview produced before payment and
   * architect release must carry one (FR-531); a released set passes null.
   */
  readonly watermark?: string | null;
  /** Dimension chains and grid bubbles. On by default. */
  readonly dimensions?: boolean;
  readonly gridBubbles?: boolean;
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
  finest: ScaleDenominator = requested,
): { scale: ScaleDenominator; atRequested: boolean } {
  const plan = { width: planWidthM, height: planHeightM };
  const fits = (scale: ScaleDenominator) => placePlanAtScale(plan, viewport, scale).fits;

  if (fits(requested)) {
    /*
     * The requested scale fits — but on a small building it can leave the sheet
     * almost empty: a 5.5 m house at 1:100 is 55 mm across a 280 mm viewport.
     * A draughtsman would draw that at 1:50. Step finer while it still fits,
     * never past the profile's finest *plan* scale, because past that the
     * drawing stops reading as a plan and starts reading as a detail.
     */
    let best = requested;
    for (const candidate of STANDARD_SCALES) {
      if (candidate >= requested || candidate < finest) continue;
      if (fits(candidate)) best = Math.min(best, candidate);
    }
    return { scale: best, atRequested: best === requested };
  }

  // Too big for the requested scale: step coarser rather than squash it.
  for (const candidate of STANDARD_SCALES) {
    if (candidate <= requested) continue;
    if (fits(candidate)) return { scale: candidate, atRequested: false };
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

/**
 * What the painter needs from a polygon.
 *
 * `PlanPolygon` itself, rather than a local copy: the copy drifted once
 * already, silently dropping the cross-hatch flag the derivation had started
 * setting.
 */
type DrawablePolygon = PlanPolygon;

function tracePolygon(
  doc: PdfDoc,
  polygon: DrawablePolygon,
  project: (p: readonly [number, number]) => [number, number],
): void {
  const [first, ...rest] = polygon.points.map(project);
  doc.moveTo(first![0], first![1]);
  for (const [px, py] of rest) doc.lineTo(px, py);
  doc.closePath();
}

/**
 * Trim one ruled line to a box, Liang–Barsky style.
 *
 * The clip path already hides whatever falls outside the shape, but it hides
 * it from the *eye* — the coordinates are still written into the content
 * stream, where the stamp-reserve check reads them and where they bloat the
 * file. Emitting a segment that stops at the shape's own bounding box keeps
 * the page honest about where its ink is.
 *
 * Returns null when the line misses the box entirely.
 */
function clipToBox(
  px: number,
  py: number,
  dx: number,
  dy: number,
  reach: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
): [number, number, number, number] | null {
  let t0 = -reach;
  let t1 = reach;
  const limits: [number, number, number][] = [
    [-dx, px - minX, 0],
    [dx, maxX - px, 0],
    [-dy, py - minY, 0],
    [dy, maxY - py, 0],
  ];
  for (const [p, q] of limits) {
    if (p === 0) {
      // Parallel to this edge: outside it means the whole line misses.
      if (q < 0) return null;
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return null;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return null;
      if (r < t1) t1 = r;
    }
  }
  if (t1 <= t0) return null;
  return [px + dx * t0, py + dy * t0, px + dx * t1, py + dy * t1];
}

/**
 * Rule a hatch pattern inside a shape.
 *
 * The shape is used as a clip path and parallel lines are swept across its
 * bounding box, which is exact for any polygon — including the concave,
 * mitred wall outlines — without needing line/polygon intersection maths.
 * Spacing is a paper dimension, so the pattern reads the same density on a
 * 1:20 detail as on a 1:100 plan.
 */
function drawHatch(
  doc: PdfDoc,
  polygon: DrawablePolygon,
  project: (p: readonly [number, number]) => [number, number],
): void {
  const hatch = polygon.hatch;
  if (!hatch) return;
  const projected = polygon.points.map(project);
  const xs = projected.map(([x]) => x);
  const ys = projected.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const spacing = mm(hatch.spacingMm);
  if (spacing <= 0) return;
  const diagonal = Math.hypot(maxX - minX, maxY - minY);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  // The reference legend's "block masonry wall" is a cross-hatch, so a second
  // sweep runs at the mirrored angle unless the caller asks for one direction.
  const angles = hatch.crossed === false ? [hatch.angleDeg] : [hatch.angleDeg, -hatch.angleDeg];

  doc.save();
  tracePolygon(doc, polygon, project);
  doc.clip();
  doc.lineWidth(mm(hatch.weightMm));

  for (const degrees of angles) {
    const angle = (degrees * Math.PI) / 180;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    // Sweeping the whole diagonal is correct but wasteful: a wall is long and
    // thin, so most of its bounding box is empty and nearly every ruled line
    // would be clipped away after being written to the page. Projecting the
    // polygon onto the hatch normal gives the range that can actually show,
    // which on a storey of walls is the difference between a few hundred
    // strokes and a few thousand.
    let lo = Infinity;
    let hi = -Infinity;
    for (const [px, py] of projected) {
      const t = -dy * (px - cx) + dx * (py - cy);
      if (t < lo) lo = t;
      if (t > hi) hi = t;
    }
    if (!Number.isFinite(lo)) continue;

    const first = Math.ceil(lo / spacing) * spacing;
    for (let offset = first; offset <= hi; offset += spacing) {
      // A point on the line, displaced along the normal by `offset`.
      const px = cx - dy * offset;
      const py = cy + dx * offset;
      const span = clipToBox(px, py, dx, dy, diagonal, minX, maxX, minY, maxY);
      if (!span) continue;
      doc.moveTo(span[0], span[1]).lineTo(span[2], span[3]).stroke(hatch.stroke);
    }
  }
  doc.restore();
}

function drawPolygon(
  doc: PdfDoc,
  polygon: DrawablePolygon,
  project: (p: readonly [number, number]) => [number, number],
): void {
  if (polygon.points.length < 3) return;

  if (polygon.hatch) {
    // Hatch replaces the flat fill: rule the interior, then outline it.
    drawHatch(doc, polygon, project);
    tracePolygon(doc, polygon, project);
    doc.lineWidth(mm(polygon.weightMm ?? 0.25)).stroke(polygon.stroke ?? INK);
    return;
  }

  tracePolygon(doc, polygon, project);
  doc.lineWidth(mm(polygon.weightMm ?? 0.25));

  if (polygon.fill && polygon.stroke) {
    doc.fillAndStroke(polygon.fill, polygon.stroke);
  } else if (polygon.fill) {
    doc.fill(polygon.fill);
  } else {
    doc.stroke(polygon.stroke ?? INK);
  }
}

/**
 * Draw one level's plan.
 *
 * Order is load-bearing, not cosmetic. Walls are painted first, then the
 * openings are knocked out of them in the sheet colour, then jambs and symbols
 * are drawn on top. Emitting these in any other order either buries the
 * symbols under the wall poché or leaves the openings solid.
 */
function drawPlan(
  doc: PdfDoc,
  drawing: PlanDrawing,
  placement: ReturnType<typeof placePlanAtScale>,
  originX: number,
  originY: number,
): void {
  const project = projector(placement, originX, originY);

  doc.save();
  for (const polygon of drawing.polygons) drawPolygon(doc, polygon, project);
  doc.restore();

  doc.save();
  for (const knockOut of drawing.knockOuts) drawPolygon(doc, knockOut, project);
  doc.restore();

  doc.save();
  for (const path of drawing.paths) {
    if (path.points.length < 2) continue;
    const [first, ...rest] = path.points.map(project);
    doc.moveTo(first![0], first![1]);
    for (const [px, py] of rest) doc.lineTo(px, py);
    doc.lineWidth(mm(path.weightMm));
    const lineType = path.lineType ?? (path.dashed ? "dashed" : "solid");
    if (lineType !== "solid") applyLineType(doc, lineType);
    doc.stroke(path.stroke);
    if (lineType !== "solid") doc.undash();
  }
  doc.restore();

  for (const label of drawing.labels) {
    const [px, py] = project(label.at);
    const size = mm(label.sizeMm ?? 2);

    doc.save();
    doc.font(label.bold ? "Helvetica-Bold" : "Helvetica").fontSize(size).fillColor(INK);

    // Size the box to the text rather than using a fixed wide one: a 40 mm box
    // centred near the sheet edge runs off the page and the label is clipped.
    const boxWidth = doc.widthOfString(label.text) + mm(2);

    if (label.rotateDeg) {
      doc.rotate(label.rotateDeg, { origin: [px, py] });
    }
    if (label.shape) {
      drawLabelShape(doc, label.shape, px, py, doc.widthOfString(label.text), size, mm(label.padMm ?? 1.1));
      doc.fillColor(INK);
    }
    // `baseline: "middle"` centres on the text's own vertical middle. Nudging
    // by half the font size instead lands on the ascender top and leaves every
    // ring and tag looking a millimetre low.
    doc.text(label.text, px - boxWidth / 2, py, {
      width: boxWidth,
      align: label.align ?? "center",
      lineBreak: false,
      baseline: "middle",
    });
    doc.restore();
  }
}

/**
 * The tag around a label, knocked out of whatever it sits over.
 *
 * Sized from the measured text, so it is a true paper dimension at any
 * drawing scale and a long room name gets a wider box rather than a clipped
 * one. Filled in the sheet colour first: a room tag over a bed, or a door
 * mark over a swing arc, has to read.
 */
function drawLabelShape(
  doc: PdfDoc,
  shape: LabelShape,
  cx: number,
  cy: number,
  textWidth: number,
  textHeight: number,
  pad: number,
): void {
  const halfW = textWidth / 2 + pad;
  const halfH = textHeight / 2 + pad * 0.7;

  if (shape === "box") {
    doc
      .rect(cx - halfW, cy - halfH, halfW * 2, halfH * 2)
      .lineWidth(mm(PEN.annotation))
      .fillAndStroke(PAPER, INK);
    return;
  }

  // A circle or hexagon has to clear the text's diagonal, not its width.
  const radius = Math.max(Math.hypot(halfW, halfH), textHeight * 0.9);
  const sides = shape === "circle" ? 32 : 6;
  // Flat-top hexagon, as the reference draws its door marks.
  const phase = shape === "hexagon" ? 0 : 0;
  for (let i = 0; i < sides; i += 1) {
    const a = phase + (Math.PI * 2 * i) / sides;
    const x = cx + radius * Math.cos(a);
    const y = cy + radius * Math.sin(a);
    if (i === 0) doc.moveTo(x, y);
    else doc.lineTo(x, y);
  }
  doc.closePath().lineWidth(mm(PEN.annotation)).fillAndStroke(PAPER, INK);
}

/**
 * Set pdfkit's dash pattern for a line type.
 *
 * pdfkit's `dash` takes one length and one gap, so a true chain-dash — long,
 * gap, dot, gap — is expressed as a four-entry array, which it accepts as the
 * first argument. Lengths are paper millimetres, so a gridline reads the same
 * on a 1:50 plan as on a 1:200 one.
 */
function applyLineType(doc: PdfDoc, lineType: Exclude<LineType, "solid">): void {
  if (lineType === "dash-dot") {
    doc.dash([mm(6), mm(1.5), mm(0.6), mm(1.5)]);
    return;
  }
  doc.dash(mm(3), { space: mm(1.5) });
}

/**
 * The legend and finishing-notes blocks, in the band below the drawing.
 *
 * They sit between the sheet caption on the left and the title block on the
 * right, which is where the reference set puts them. Content comes entirely
 * from the jurisdiction profile, so a second profile changes the wording
 * without touching this function (FR-60, FR-63).
 *
 * Returns nothing: if the profile declares no blocks, nothing is drawn.
 */
function drawPlanBlocks(
  doc: PdfDoc,
  blocks: PlanSheetBlocks,
  project: ProjectMetadata,
  viewport: BoxPt,
): void {
  const top = viewport.y + viewport.height + mm(4);
  const notesX = viewport.x + viewport.width * 0.42;
  const legendX = viewport.x + viewport.width * 0.72;

  doc.save();

  // ---- Finishing notes --------------------------------------------------
  doc.font("Helvetica").fontSize(mm(1.7)).fillColor(INK);
  doc.text(blocks.notesTitle, notesX, top, { width: mm(60), lineBreak: false });
  doc
    .moveTo(notesX, top + mm(2.4))
    .lineTo(notesX + mm(58), top + mm(2.4))
    .lineWidth(mm(0.2))
    .stroke(INK);

  let y = top + mm(4.4);
  for (const note of blocks.notes) {
    const text = note
      .replace("{floorFinish}", project.floorFinish ?? "600MMX600MM")
      .replace("{wallTile}", project.wallTile ?? "300MMX300MM");
    doc.fontSize(mm(1.5)).text(`-  ${text}`, notesX, y, {
      width: mm(56),
      lineGap: mm(0.25),
    });
    y = doc.y + mm(0.8);
  }

  // ---- Legend -----------------------------------------------------------
  doc.font("Helvetica").fontSize(mm(1.7)).fillColor(INK);
  doc.text(blocks.legendTitle, legendX, top, { width: mm(40), lineBreak: false });

  const rowH = mm(3.4);
  const markW = mm(10);
  const tableW = mm(46);
  let rowY = top + mm(3);

  for (const entry of blocks.legend) {
    doc
      .moveTo(legendX, rowY)
      .lineTo(legendX + tableW, rowY)
      .lineWidth(mm(0.15))
      .stroke(HAIRLINE);

    if (entry.swatch) {
      const box = { x: legendX + mm(1), y: rowY + mm(0.6), w: markW - mm(2), h: rowH - mm(1.4) };
      if (entry.swatch === "solid") {
        doc.rect(box.x, box.y, box.w, box.h).fill(INK);
      } else {
        drawHatch(
          doc,
          {
            points: [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 1],
            ],
            hatch: MASONRY_HATCH,
          },
          ([u, v]) => [box.x + u * box.w, box.y + v * box.h],
        );
        doc.rect(box.x, box.y, box.w, box.h).lineWidth(mm(0.15)).stroke(INK);
      }
    } else if (entry.mark) {
      doc
        .font("Helvetica")
        .fontSize(mm(1.5))
        .fillColor(INK)
        .text(entry.mark, legendX, rowY + mm(0.9), { width: markW, align: "center", lineBreak: false });
    }

    doc
      .font("Helvetica")
      .fontSize(mm(1.5))
      .fillColor(INK)
      .text(entry.label, legendX + markW + mm(1.5), rowY + mm(0.9), {
        width: tableW - markW - mm(2),
        lineBreak: false,
      });

    rowY += rowH;
  }
  doc
    .moveTo(legendX, rowY)
    .lineTo(legendX + tableW, rowY)
    .lineWidth(mm(0.15))
    .stroke(HAIRLINE);
  // The vertical rule separating mark from description.
  doc
    .moveTo(legendX + markW, top + mm(3))
    .lineTo(legendX + markW, rowY)
    .lineWidth(mm(0.15))
    .stroke(HAIRLINE);

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

/**
 * The caption states the scale the sheet is actually drawn at, and nothing
 * else. Whether that is the profile's default is the studio's business, not
 * the drawing's — a submission sheet annotated with its own deviation reads as
 * an unfinished draft. Callers get the fact as `atDefaultScale` on each
 * returned sheet and surface it in the editor instead.
 */
function drawSheetCaption(
  doc: PdfDoc,
  viewport: BoxPt,
  title: string,
  scale: ScaleDenominator,
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
    .text(`SCALE 1:${scale}`, viewport.x + mm(4), baseline + mm(4), {
      width: viewport.width,
    });
  doc.restore();
}

/**
 * The preview stamp.
 *
 * It has to be unmissable — this file is not for submission — but a drawing
 * nobody can read is not a useful preview either. Kept large enough to be
 * obvious at a glance and light enough to read dimensions and door swings
 * straight through.
 */
function drawWatermark(doc: PdfDoc, page: Page, text: string): void {
  doc.save();
  doc.rotate(-32, { origin: [page.widthPt / 2, page.heightPt / 2] });
  doc
    .font("Helvetica-Bold")
    .fontSize(mm(11))
    .fillColor(WATERMARK, 0.3)
    .text(text, 0, page.heightPt / 2 - mm(6), {
      width: page.widthPt,
      align: "center",
      lineBreak: false,
    });
  doc.restore();
}

/**
 * Compose and emit the architectural sheet set.
 */
export async function renderSheetSet(options: SheetSetOptions): Promise<SheetSetResult> {
  const { profile, project, levels, watermark = null, dimensions = true, gridBubbles = true } = options;
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

    /*
     * Scale is chosen against the *building*, in a viewport already reduced by
     * the annotation's paper margin. Choosing it against a bounds that already
     * included the annotation would be circular: the margin is a paper
     * dimension, so how much plan space it occupies depends on the scale.
     */
    const marginMm = annotationMarginMm(gridBubbles);
    const buildingViewport: BoxPt = {
      x: viewport.x + mm(marginMm),
      y: viewport.y,
      width: Math.max(viewport.width - mm(marginMm), 1),
      height: Math.max(viewport.height - mm(marginMm), 1),
    };

    const building = boundsExtent(level.bounds);
    const { scale, atRequested } = resolveSheetScale(
      building.width,
      building.height,
      buildingViewport,
      requestedScale,
      profile.finestPlanScale,
    );

    // Now the scale is known, the annotation can be built at the right size.
    const annotations = dimensions
      ? deriveDimensions(level.walls, level.bounds, {
          units: profile.units,
          gridBubbles,
          scale,
        })
      : { paths: [], labels: [] };

    const marginPlan = (marginMm * scale) / 1000;
    const sheetBounds: PlanBounds = {
      minX: level.bounds.minX - marginPlan,
      minY: level.bounds.minY,
      maxX: level.bounds.maxX,
      maxY: level.bounds.maxY + marginPlan,
    };
    const extent = boundsExtent(sheetBounds);
    const placement = placePlanAtScale(
      { width: extent.width, height: extent.height },
      viewport,
      scale,
    );

    const drawing: PlanDrawing = {
      ...level.drawing,
      paths: [...level.drawing.paths, ...annotations.paths],
      labels: [...level.drawing.labels, ...annotations.labels],
    };

    const title = floorPlanTitle(level.name);
    const code = sheetCodeAt(
      planSheet ?? { code: baseCode, title, scale, repeat: "per-level" },
      index,
    );

    drawPlan(doc, drawing, placement, sheetBounds.minX, sheetBounds.minY);
    drawSheetCaption(doc, viewport, title, scale);
    if (profile.planBlocks) drawPlanBlocks(doc, profile.planBlocks, project, viewport);
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

/** Sentence case for the sheet strip. The PDF title stays in capitals. */
export function customerPlanTitle(levelName: string): string {
  const title = floorPlanTitle(levelName).toLowerCase();
  return title.charAt(0).toUpperCase() + title.slice(1);
}

/**
 * Sheets the current model can actually produce.
 *
 * Only storeys with wall geometry are emitted — the same filter as
 * `renderSheetSet` — so the strip does not list elevations, schedules, or
 * empty floors.
 */
export function listProduciblePlanSheets(
  nodes: SceneNodes,
  profile: JurisdictionProfile,
): { code: string; title: string }[] {
  const planSheet = profile.sheets.find((sheet) => sheet.repeat === "per-level");
  const definition = planSheet ?? {
    code: "A.01",
    title: "FLOOR PLAN",
    scale: profile.defaultPlanScale,
    repeat: "per-level" as const,
  };
  return derivePlanLevels(nodes).map((level, index) => ({
    code: sheetCodeAt(definition, index),
    title: customerPlanTitle(level.name),
  }));
}

/**
 * The drawing title for a storey.
 *
 * A level called "Level" would otherwise print "LEVEL FLOOR PLAN", and one
 * already called "Ground Floor" would print "GROUND FLOOR FLOOR PLAN". Both
 * read as a bug on a submission sheet.
 */
export function floorPlanTitle(levelName: string): string {
  const name = levelName.trim().toUpperCase();
  if (!name || name === "LEVEL") return "FLOOR PLAN";
  if (name.endsWith("PLAN")) return name;
  if (name.includes("FLOOR")) return `${name} PLAN`;
  return `${name} FLOOR PLAN`;
}

/** A dimension string as the profile prints it, for callers building labels. */
export function dimensionLabel(metres: number, profile: JurisdictionProfile): string {
  const { primary, secondary } = formatDimension(metres, profile.units);
  return secondary ? `${primary}\n${secondary}` : primary;
}
