/**
 * Emits a printable calibration sheet so the true-scale claim can be checked
 * against a physical ruler, not just a test assertion.
 *
 * Print at 100% / "actual size" — NOT "fit to page", which would rescale the
 * very thing being measured. Then check the calibration bar reads 100 mm.
 *
 *   npm run emit:calibration
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { renderSheetToPdf, type PlanSegmentM } from "../src/lib/sheets/pdf-sheet.ts";
import { pointsToMm } from "../src/lib/sheets/scale.ts";

const SCALE = 100;

// The Everglow building footprint from the reference set (sheet A.01):
// 19.092 m × 8.487 m overall, grid A–F by 1–4.
const PLAN = { width: 19.092, height: 8.487 };

function rectangle(
  x: number,
  y: number,
  width: number,
  height: number,
  weightMm: number,
): PlanSegmentM[] {
  const corners: [number, number][] = [
    [x, y],
    [x + width, y],
    [x + width, y + height],
    [x, y + height],
  ];
  return corners.map((from, index) => ({
    from,
    to: corners[(index + 1) % corners.length]!,
    weightMm,
  }));
}

/**
 * A 10 m bar, which at 1:100 must measure exactly 100 mm on the print, with
 * a tick each metre. Drawn in plan metres like everything else, so it is
 * subject to precisely the same projection as the building.
 */
function calibrationBar(originX: number, originY: number): PlanSegmentM[] {
  const segments: PlanSegmentM[] = [
    { from: [originX, originY], to: [originX + 10, originY], weightMm: 0.5 },
  ];
  for (let metre = 0; metre <= 10; metre += 1) {
    const tall = metre % 5 === 0;
    segments.push({
      from: [originX + metre, originY],
      to: [originX + metre, originY - (tall ? 0.6 : 0.3)],
      weightMm: tall ? 0.5 : 0.25,
    });
  }
  return segments;
}

// Grid lines A–F at the reference set's bay spacings, in millimetres.
const BAY_WIDTHS_MM = [3823, 3808, 3808, 3808, 3845];

function gridLines(): PlanSegmentM[] {
  const segments: PlanSegmentM[] = [];
  let x = 0;
  for (const bay of [0, ...BAY_WIDTHS_MM]) {
    x += bay / 1000;
    segments.push({
      from: [x, -0.8],
      to: [x, PLAN.height + 0.8],
      weightMm: 0.13,
    });
  }
  return segments;
}

async function main(): Promise<void> {
  const segments: PlanSegmentM[] = [
    ...rectangle(0, 0, PLAN.width, PLAN.height, 0.5),
    ...gridLines(),
    ...calibrationBar(0, -2.5),
  ];

  const { pdf, placement, pageSize } = await renderSheetToPdf({
    page: "A3",
    orientation: "landscape",
    marginMm: 15,
    scale: SCALE,
    plan: { width: PLAN.width, height: PLAN.height + 3.5 },
    segments: segments.map((s) => ({
      ...s,
      // Shift up so the calibration bar below y=0 stays on the sheet.
      from: [s.from[0], s.from[1] + 3.5] as const,
      to: [s.to[0], s.to[1] + 3.5] as const,
    })),
  });

  const outDir = path.resolve(import.meta.dirname, "..", "out");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "calibration-1-100.pdf");
  await writeFile(outPath, pdf);

  const widthMm = pointsToMm(placement.box.width);
  console.log(`Wrote ${outPath}`);
  console.log(`  page          A3 landscape (${pointsToMm(pageSize[0]).toFixed(1)} x ${pointsToMm(pageSize[1]).toFixed(1)} mm)`);
  console.log(`  scale         1:${placement.scale}`);
  console.log(`  plan on paper ${widthMm.toFixed(2)} mm wide`);
  console.log(`  fits          ${placement.fits ? "yes" : `NO (overflow ${pointsToMm(placement.overflow.width).toFixed(1)} mm)`}`);
  console.log("");
  console.log("Print at 100% / actual size (not 'fit to page'), then check:");
  console.log("  - the calibration bar measures 100 mm end to end");
  console.log("  - the building outline measures 190.9 mm wide, 84.9 mm tall");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
