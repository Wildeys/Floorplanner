/**
 * The true-scale spike's verification.
 *
 * These tests do not check our arithmetic — scale.test.ts does that. They emit
 * a real PDF, read the path operators back out of its content stream, and
 * measure them. That is the only way to catch the bugs that actually break a
 * printed drawing: a wrong page-size unit, an unexpected PDFKit transform, or a
 * scale applied twice. Arithmetic tests pass happily through all three.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { projectPlanPoint, renderSheetToPdf, sheetViewport } from "./pdf-sheet.ts";
import { pageSizePoints, placePlanAtScale, pointsToMm } from "./scale.ts";

const PRINT_TOLERANCE_MM = 0.5;

/** Every `x y m` / `x y l` operator in the PDF's uncompressed content streams. */
function readPathPoints(pdf: Buffer): [number, number][] {
  const text = pdf.toString("latin1");
  const points: [number, number][] = [];
  const operator = /(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+([ml])\b/g;
  let match: RegExpExecArray | null;
  while ((match = operator.exec(text)) !== null) {
    points.push([Number(match[1]), Number(match[2])]);
  }
  return points;
}

/** The page's declared MediaBox, in points. */
function readMediaBox(pdf: Buffer): [number, number, number, number] {
  const text = pdf.toString("latin1");
  const match =
    /\/MediaBox\s*\[\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*\]/.exec(text);
  assert.ok(match, "no /MediaBox found in emitted PDF");
  return [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])];
}

function distance(a: [number, number], b: [number, number]): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

test("a 10 m wall emitted at 1:100 measures 100 mm in the PDF", async () => {
  const { pdf } = await renderSheetToPdf({
    page: "A3",
    orientation: "landscape",
    scale: 100,
    plan: { width: 10, height: 5 },
    segments: [{ from: [0, 0], to: [10, 0] }],
  });

  const points = readPathPoints(pdf);
  assert.equal(points.length, 2, `expected one segment, got ${points.length} points`);

  const drawnMm = pointsToMm(distance(points[0]!, points[1]!));
  assert.ok(
    Math.abs(drawnMm - 100) < PRINT_TOLERANCE_MM,
    `expected 100 mm on paper, measured ${drawnMm.toFixed(4)} mm`,
  );
});

test("the reference building's 19.092 m width measures 190.92 mm at 1:100", async () => {
  // Grid A→F on sheet A.01 of the reference set.
  const { pdf } = await renderSheetToPdf({
    page: "A3",
    orientation: "landscape",
    scale: 100,
    plan: { width: 19.092, height: 8.487 },
    segments: [{ from: [0, 0], to: [19.092, 0] }],
  });

  const [a, b] = readPathPoints(pdf);
  const drawnMm = pointsToMm(distance(a!, b!));
  assert.ok(
    Math.abs(drawnMm - 190.92) < PRINT_TOLERANCE_MM,
    `expected 190.92 mm, measured ${drawnMm.toFixed(4)} mm`,
  );
});

test("the same model at 1:50 measures exactly twice as long", async () => {
  const measure = async (scale: number) => {
    const { pdf } = await renderSheetToPdf({
      page: "A2",
      orientation: "landscape",
      scale,
      plan: { width: 10, height: 5 },
      segments: [{ from: [0, 0], to: [10, 0] }],
    });
    const [a, b] = readPathPoints(pdf);
    return pointsToMm(distance(a!, b!));
  };

  const at100 = await measure(100);
  const at50 = await measure(50);
  assert.ok(
    Math.abs(at50 - at100 * 2) < PRINT_TOLERANCE_MM,
    `1:50 should be double 1:100 — got ${at50.toFixed(3)} vs ${at100.toFixed(3)}`,
  );
});

test("a bigger sheet does not draw a bigger building", async () => {
  const measureOn = async (page: "A4" | "A2") => {
    const { pdf } = await renderSheetToPdf({
      page,
      orientation: "landscape",
      scale: 100,
      plan: { width: 10, height: 5 },
      segments: [{ from: [0, 0], to: [10, 0] }],
    });
    const [a, b] = readPathPoints(pdf);
    return pointsToMm(distance(a!, b!));
  };

  // The regression that fit-to-page would introduce.
  const onA4 = await measureOn("A4");
  const onA2 = await measureOn("A2");
  assert.ok(
    Math.abs(onA4 - onA2) < 1e-6,
    `scale must not depend on page size — A4 ${onA4}, A2 ${onA2}`,
  );
  assert.ok(Math.abs(onA4 - 100) < PRINT_TOLERANCE_MM);
});

test("the emitted page is physically the size we asked for", async () => {
  const { pdf, pageSize } = await renderSheetToPdf({
    page: "A3",
    orientation: "landscape",
    scale: 100,
    plan: { width: 10, height: 5 },
    segments: [{ from: [0, 0], to: [1, 0] }],
  });

  const [x0, y0, x1, y1] = readMediaBox(pdf);
  const widthMm = pointsToMm(x1 - x0);
  const heightMm = pointsToMm(y1 - y0);

  assert.ok(Math.abs(widthMm - 420) < PRINT_TOLERANCE_MM, `A3 landscape width ${widthMm}`);
  assert.ok(Math.abs(heightMm - 297) < PRINT_TOLERANCE_MM, `A3 landscape height ${heightMm}`);
  assert.deepEqual(pageSize, pageSizePoints("A3", "landscape"));
});

test("plan y grows up the page, not down", () => {
  const pageSize = pageSizePoints("A3", "landscape");
  const placement = placePlanAtScale(
    { width: 10, height: 5 },
    sheetViewport(pageSize, 12),
    100,
  );

  const bottom = projectPlanPoint([0, 0], placement);
  const top = projectPlanPoint([0, 5], placement);

  // PDFKit's y grows downward, so a point higher in the plan must have a
  // smaller page y. Getting this backwards mirrors the drawing without
  // changing any measured length.
  assert.ok(top[1] < bottom[1], `plan top ${top[1]} should sit above bottom ${bottom[1]}`);
  assert.ok(Math.abs(pointsToMm(bottom[1] - top[1]) - 50) < PRINT_TOLERANCE_MM);

  // And x grows rightward.
  const right = projectPlanPoint([10, 0], placement);
  assert.ok(right[0] > bottom[0]);
  assert.ok(Math.abs(pointsToMm(right[0] - bottom[0]) - 100) < PRINT_TOLERANCE_MM);
});

test("line weight is a paper dimension, unaffected by drawing scale", async () => {
  const widthsFor = async (scale: number) => {
    const { pdf } = await renderSheetToPdf({
      page: "A3",
      scale,
      plan: { width: 10, height: 5 },
      segments: [{ from: [0, 0], to: [5, 0], weightMm: 0.5 }],
    });
    const match = /(-?[\d.]+)\s+w\b/.exec(pdf.toString("latin1"));
    assert.ok(match, "no line-width operator emitted");
    return pointsToMm(Number(match[1]));
  };

  // A 0.5 mm pen stays 0.5 mm whether the drawing is 1:50 or 1:200.
  assert.ok(Math.abs((await widthsFor(50)) - 0.5) < 0.01);
  assert.ok(Math.abs((await widthsFor(200)) - 0.5) < 0.01);
});

test("an oversized plan still emits, and reports that it overflowed", async () => {
  const { placement } = await renderSheetToPdf({
    page: "A4",
    scale: 100,
    plan: { width: 50, height: 40 },
    segments: [{ from: [0, 0], to: [50, 0] }],
  });

  // True scale means overflow is surfaced, never absorbed by rescaling.
  assert.equal(placement.fits, false);
  assert.ok(placement.overflow.width > 0);
  assert.equal(placement.scale, 100);
  assert.ok(Math.abs(pointsToMm(placement.box.width) - 500) < PRINT_TOLERANCE_MM);
});
