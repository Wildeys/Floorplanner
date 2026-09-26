import { test } from "node:test";
import assert from "node:assert/strict";

import {
  chooseScaleThatFits,
  metresToPoints,
  mmToPoints,
  pageSizeMm,
  pageSizePoints,
  placePlanAtScale,
  pointsToMetres,
  pointsToMm,
  POINTS_PER_MM,
} from "./scale.ts";

/** Tolerance for "measures true on paper", in millimetres (NFR-6). */
const PRINT_TOLERANCE_MM = 0.5;

test("a millimetre is 72/25.4 points", () => {
  assert.ok(Math.abs(POINTS_PER_MM - 2.834645669) < 1e-8);
  assert.ok(Math.abs(pointsToMm(mmToPoints(123.4)) - 123.4) < 1e-9);
});

test("at 1:100 a 10 m wall measures 100 mm on paper", () => {
  const drawnMm = pointsToMm(metresToPoints(10, 100));
  assert.ok(
    Math.abs(drawnMm - 100) < PRINT_TOLERANCE_MM,
    `expected 100 mm, drew ${drawnMm} mm`,
  );
});

test("each standard scale renders a known length correctly", () => {
  // real metres, scale, expected millimetres on paper
  const cases: [number, number, number][] = [
    [1, 20, 50],
    [10, 50, 200],
    [10, 100, 100],
    [19.092, 100, 190.92], // the reference set's overall building width
    [100, 200, 500],
    [100, 500, 200],
  ];
  for (const [metres, scale, expectedMm] of cases) {
    const actualMm = pointsToMm(metresToPoints(metres, scale));
    assert.ok(
      Math.abs(actualMm - expectedMm) < PRINT_TOLERANCE_MM,
      `${metres} m at 1:${scale} should be ${expectedMm} mm, got ${actualMm}`,
    );
  }
});

test("metres and points round-trip at a given scale", () => {
  for (const scale of [20, 50, 100, 200]) {
    const restored = pointsToMetres(metresToPoints(8.487, scale), scale);
    assert.ok(Math.abs(restored - 8.487) < 1e-9, `scale 1:${scale}`);
  }
});

test("scale must be positive and finite", () => {
  assert.throws(() => metresToPoints(1, 0), RangeError);
  assert.throws(() => metresToPoints(1, -100), RangeError);
  assert.throws(() => metresToPoints(1, Number.NaN), RangeError);
  assert.throws(() => metresToPoints(Number.POSITIVE_INFINITY, 100), RangeError);
});

test("placement size depends on the model and scale, never on the viewport", () => {
  const plan = { width: 19.092, height: 8.487 };
  const small = placePlanAtScale(plan, { x: 0, y: 0, width: 400, height: 400 }, 100);
  const large = placePlanAtScale(plan, { x: 0, y: 0, width: 4000, height: 4000 }, 100);

  // This is the whole point of true scale: a bigger page does not draw a
  // bigger building. Fit-to-page would fail this test.
  assert.equal(small.box.width, large.box.width);
  assert.equal(small.box.height, large.box.height);
  assert.ok(Math.abs(pointsToMm(small.box.width) - 190.92) < PRINT_TOLERANCE_MM);
});

test("placement centres the plan in the viewport", () => {
  const placement = placePlanAtScale(
    { width: 10, height: 10 },
    { x: 100, y: 200, width: 600, height: 600 },
    100,
  );
  const side = metresToPoints(10, 100);
  assert.ok(Math.abs(placement.box.x - (100 + (600 - side) / 2)) < 1e-9);
  assert.ok(Math.abs(placement.box.y - (200 + (600 - side) / 2)) < 1e-9);
});

test("overflow is reported rather than absorbed", () => {
  // A 50 m building at 1:100 is 500 mm wide — wider than any A3 viewport.
  const placement = placePlanAtScale(
    { width: 50, height: 5 },
    { x: 0, y: 0, width: mmToPoints(250), height: mmToPoints(250) },
    100,
  );
  assert.equal(placement.fits, false);
  assert.ok(placement.overflow.width > 0);
  assert.equal(placement.overflow.height, 0);
  // Still placed, so it can be rendered for diagnosis.
  assert.ok(Math.abs(pointsToMm(placement.box.width) - 500) < PRINT_TOLERANCE_MM);
  // And the requested scale is never quietly changed.
  assert.equal(placement.scale, 100);
});

test("a plan that fits reports no overflow", () => {
  const placement = placePlanAtScale(
    { width: 19.092, height: 8.487 },
    { x: 0, y: 0, width: mmToPoints(250), height: mmToPoints(250) },
    100,
  );
  assert.equal(placement.fits, true);
  assert.deepEqual(placement.overflow, { width: 0, height: 0 });
});

test("chooseScaleThatFits prefers the finest scale that still fits", () => {
  const viewport = { x: 0, y: 0, width: mmToPoints(250), height: mmToPoints(250) };

  // 4 m room: 1:20 gives 200 mm, which fits.
  assert.equal(chooseScaleThatFits({ width: 4, height: 4 }, viewport), 20);

  // The reference building at 1:20 would be 955 mm; 1:100 gives 191 mm.
  assert.equal(chooseScaleThatFits({ width: 19.092, height: 8.487 }, viewport), 100);

  // Nothing in the candidate list can fit a 500 m site on a 250 mm viewport.
  assert.equal(chooseScaleThatFits({ width: 500, height: 500 }, viewport, [20, 50]), null);
});

test("page sizes match the ISO A series", () => {
  assert.deepEqual(pageSizeMm("A3"), [297, 420]);
  assert.deepEqual(pageSizeMm("A3", "landscape"), [420, 297]);

  const [w, h] = pageSizePoints("A4");
  assert.ok(Math.abs(w - 595.28) < 0.01, `A4 width ${w}`);
  assert.ok(Math.abs(h - 841.89) < 0.01, `A4 height ${h}`);
});
