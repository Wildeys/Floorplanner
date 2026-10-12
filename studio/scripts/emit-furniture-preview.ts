/**
 * Emits every furniture symbol at 1:50 so the drawings can be judged on paper
 * rather than in a test assertion — and measured against a scale rule.
 *
 * Nothing here is downloaded. Each piece is drawn from its own `plan()`, so
 * what prints is exactly what the 2D view and the PDF sheets draw.
 *
 * Print at 100% / "actual size" — NOT "fit to page", which rescales the very
 * thing being checked. Then a 1.4 m desk must measure 28 mm across.
 *
 *   npm run emit:furniture
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  FURNITURE,
  FURNITURE_BY_ID,
  drawSymbolPdf,
  furnitureSymbol,
  itemToPlan,
  type Pen,
} from "../src/lib/sheets/furniture-library.ts";
import { createPdfDocument, type PdfDoc } from "../src/lib/sheets/pdf-sheet.ts";
import { PEN } from "../src/lib/sheets/pens.ts";
import { mmToPoints, pageSizePoints } from "../src/lib/sheets/scale.ts";

const SCALE = 50;
const PAGE = pageSizePoints("A3", "landscape");
const MARGIN = mmToPoints(12);

/** Paper millimetres per model millimetre at this scale. */
const DRAW = mmToPoints(1 / SCALE);

/** The library's two pens, resolved against the sheet engine's pen table. */
const PEN_MM: Record<Pen, number> = { outline: PEN.seen, detail: PEN.symbol };

function caption(doc: PdfDoc, text: string, x: number, y: number, sizeMm = 1.9, bold = false): void {
  doc.save();
  doc
    .font(bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(mmToPoints(sizeMm))
    .fillColor("#111111")
    .text(text, x, y, { width: mmToPoints(80), align: "left", lineBreak: false });
  doc.restore();
}

/**
 * One piece, drawn at its default size with its name and footprint beneath.
 *
 * `(cx, cy)` is the centre of the cell in points. Returns nothing: the point
 * of the sheet is the drawing, and the caller owns the grid.
 */
function drawPiece(doc: PdfDoc, id: string, cx: number, cy: number): string[] {
  const type = FURNITURE_BY_ID.get(id)!;
  const flat = furnitureSymbol(id, type.defaults, SCALE);

  // itemToPlan works in item-local millimetres here, so composing it with a
  // flat mm -> points factor keeps one mapping all the way to the page.
  const place = itemToPlan(flat.size, 0, 0, 0);
  const toPaper = (x: number, y: number): readonly [number, number] => {
    const [px, py] = place(x, y);
    // Plan y grows up the page; PDF's grows down.
    return [cx + px * DRAW, cy - py * DRAW];
  };

  drawSymbolPdf(doc, flat, toPaper, PEN_MM);
  return flat.dropped;
}

async function main(): Promise<void> {
  const { doc, done } = await createPdfDocument(PAGE);

  // ---- Page 1: the whole catalogue, by category --------------------------
  const COLS = 7;
  const cellW = (PAGE[0] - 2 * MARGIN) / COLS;
  const gridTop = MARGIN + mmToPoints(14);
  /** Room under each symbol for its two caption lines. */
  const CAPTION_H = mmToPoints(9);

  caption(doc, "FURNITURE LIBRARY — PLAN SYMBOLS", MARGIN, MARGIN, 4, true);
  caption(
    doc,
    `${FURNITURE.length} pieces at 1:50, drawn from code. Print at 100% (not "fit to page").`,
    MARGIN,
    MARGIN + mmToPoints(5.5),
    2.2,
  );

  const dropped: string[] = [];
  const ordered = [...FURNITURE].sort(
    (a, b) => a.category.localeCompare(b.category) || a.id.localeCompare(b.id),
  );

  // Row heights follow the deepest piece in each row: a 2 m bed is 40 mm on
  // paper at 1:50 and would otherwise print straight through its own caption.
  let rowTop = gridTop;
  for (let row = 0; row * COLS < ordered.length; row += 1) {
    const inRow = ordered.slice(row * COLS, (row + 1) * COLS);
    const tallest = Math.max(...inRow.map((item) => item.defaults.d)) * DRAW;

    inRow.forEach((item, col) => {
      const cx = MARGIN + cellW * (col + 0.5);
      // Symbols sit on a common baseline so the row reads as one line of
      // drawings rather than a ragged band of centred boxes.
      const cy = rowTop + tallest - (item.defaults.d * DRAW) / 2;

      dropped.push(...drawPiece(doc, item.id, cx, cy).map((label) => `${item.id}: ${label}`));

      const textTop = rowTop + tallest + mmToPoints(2.5);
      caption(doc, item.label, MARGIN + cellW * col + mmToPoints(2), textTop, 2, true);
      caption(
        doc,
        `${item.defaults.w} x ${item.defaults.d} mm  ·  ${item.category}`,
        MARGIN + cellW * col + mmToPoints(2),
        textTop + mmToPoints(2.8),
        1.7,
      );
    });

    rowTop += tallest + CAPTION_H;
  }

  // ---- Page 2: a guest room, laid out like Room 1 on A.02 ----------------
  doc.addPage({ size: [PAGE[0], PAGE[1]], margin: 0 });
  caption(doc, "GUEST ROOM — AFTER A.02 ROOM 1", MARGIN, MARGIN, 4, true);
  caption(doc, "Same symbols, same scale, arranged as a room.", MARGIN, MARGIN + mmToPoints(5.5), 2.2);

  // Room clear dimensions, from the reference sheet's 3808 x 4668 bay.
  const ROOM = { w: 3808, d: 4668 };
  const originX = MARGIN + mmToPoints(20);
  const originY = MARGIN + mmToPoints(24);
  const toPage = (x: number, y: number): readonly [number, number] => [
    originX + x * DRAW,
    originY + y * DRAW,
  ];

  // The room shell, drawn as a single heavy outline.
  doc.save();
  doc.lineWidth(mmToPoints(PEN.cut));
  const [rx0, ry0] = toPage(0, 0);
  const [rx1, ry1] = toPage(ROOM.w, ROOM.d);
  doc.moveTo(rx0, ry0).lineTo(rx1, ry0).lineTo(rx1, ry1).lineTo(rx0, ry1).closePath().stroke("#111111");
  doc.restore();

  /** Placed pieces: centre in room millimetres, measured from the back-left. */
  const LAYOUT: { id: string; x: number; y: number; deg: number }[] = [
    { id: "bed-double", x: 1904, y: 1300, deg: 0 },
    // Clear of the bed's 1600 width: 1904 +/- 800, plus half a table.
    { id: "bedside-table", x: 850, y: 320, deg: 0 },
    { id: "bedside-table", x: 2958, y: 320, deg: 0 },
    // Against the south wall: 4668 less half the unit's depth.
    { id: "wardrobe", x: 700, y: 4368, deg: 180 },
    { id: "tv-unit", x: 2700, y: 4440, deg: 180 },
    { id: "luggage-rack", x: 3300, y: 3400, deg: 90 },
    { id: "armchair", x: 500, y: 3200, deg: 270 },
  ];

  for (const placed of LAYOUT) {
    const type = FURNITURE_BY_ID.get(placed.id)!;
    const flat = furnitureSymbol(placed.id, type.defaults, SCALE);
    const place = itemToPlan(flat.size, placed.x, placed.y, placed.deg);
    const toPaper = (x: number, y: number): readonly [number, number] => {
      const [px, py] = place(x, y);
      // The layout is quoted in page-down room coordinates, so the plan-up
      // y that itemToPlan returns is mirrored back here rather than twice.
      return toPage(px, 2 * placed.y - py);
    };
    drawSymbolPdf(doc, flat, toPaper, PEN_MM);
    dropped.push(...flat.dropped.map((label) => `${placed.id}: ${label}`));
  }

  caption(
    doc,
    `ROOM ${ROOM.w} x ${ROOM.d} mm — at 1:50 that is ${(ROOM.w / SCALE).toFixed(1)} x ${(ROOM.d / SCALE).toFixed(1)} mm on paper`,
    originX,
    originY + ROOM.d * DRAW + mmToPoints(6),
    2.2,
  );

  doc.end();
  const pdf = await done;

  const outDir = path.resolve(import.meta.dirname, "..", "out");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "furniture-preview-A3.pdf");
  await writeFile(outPath, pdf);

  console.log(`Wrote ${outPath}`);
  console.log(`  pieces    ${FURNITURE.length}`);
  console.log(`  scale     1:${SCALE}`);
  console.log(`  page      A3 landscape, 2 pages`);
  if (dropped.length > 0) {
    // Labels are reported, never squeezed — so say which ones went.
    console.log(`  dropped   ${dropped.length} label(s) too large at this scale:`);
    for (const label of dropped) console.log(`              ${label}`);
  } else {
    console.log(`  dropped   no labels`);
  }
  console.log("");
  console.log('Print at 100% / actual size (not "fit to page"), then check:');
  console.log("  - the double bed measures 32 x 40 mm");
  console.log("  - the 1400 mm desk measures 28 mm across");
  console.log(`  - the guest room measures ${(ROOM.w / SCALE).toFixed(1)} x ${(ROOM.d / SCALE).toFixed(1)} mm`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
