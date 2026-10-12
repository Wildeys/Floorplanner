import assert from "node:assert/strict";
import test from "node:test";

import { deriveItemFootprint } from "../sheets/derive-openings.ts";
import type { PlanPoint } from "../sheets/plan-types.ts";
import { itemToPlan } from "../sheets/furniture-library.ts";
import { resolveLibraryId, symbolInFootprint } from "./plan-symbol.ts";

function bounds(points: readonly PlanPoint[]) {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

test("catalogue desks and chairs resolve to library symbols", () => {
  assert.equal(resolveLibraryId({ asset: { id: "office-table", name: "Office Table" } }), "desk");
  assert.equal(resolveLibraryId({ asset: { id: "office-chair", name: "Office Chair" } }), "office-chair");
  assert.equal(resolveLibraryId({ name: "Task chair" }), "office-chair");
  assert.equal(resolveLibraryId({ asset: { id: "cactus", name: "Cactus" } }), null);
});

test("a desk symbol is the library drawing, inside its footprint", () => {
  const footprint = deriveItemFootprint({
    id: "desk",
    type: "item",
    position: [2, 0, 3],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    asset: { id: "office-table", name: "Office Table", dimensions: [1.4, 0.75, 0.7] },
  });
  assert.ok(footprint);
  const symbol = symbolInFootprint("desk", footprint!.points);
  assert.ok(symbol);
  assert.ok(symbol!.polygons.length >= 1, "the outline is part of the symbol");
  assert.ok(symbol!.paths.some((path) => path.dashed), "the pedestal is drawn dashed");

  const box = bounds(footprint!.points);
  const placed = [...symbol!.polygons.flatMap((polygon) => polygon.points), ...symbol!.paths.flatMap((path) => path.points)];
  for (const [x, y] of placed) {
    assert.ok(x >= box.minX - 1e-6 && x <= box.maxX + 1e-6, `x ${x} outside the footprint`);
    assert.ok(y >= box.minY - 1e-6 && y <= box.maxY + 1e-6, `y ${y} outside the footprint`);
  }
});

test("a symbol's back edge lands where the item's back actually is", () => {
  // A bounding-box check cannot see a flip, so compare against the library's
  // own placement maths instead: `itemToPlan` is an independent
  // implementation of the same convention, so agreement between the two is
  // real evidence rather than a tautology.
  // Track an ASYMMETRIC feature, not a corner of the outline: all four
  // corners are present whichever way the footprint is read, so an outline
  // check cannot tell a flip from the real thing. The double bed's headboard
  // line sits 60 mm in from the back edge and nowhere else.
  const HEADBOARD_M = 0.06;
  const size = { w: 1.6, d: 2, h: 0.55 };
  const centre: [number, number] = [2, -3];

  for (const degrees of [0, 30, 90, 180, 270]) {
    const radians = (degrees * Math.PI) / 180;
    const footprint = deriveItemFootprint({
      id: "b",
      type: "item",
      // Plan frame: derivePlanLevels has already mirrored world z into plan y.
      position: [centre[0], 0, centre[1]],
      dimensions: [size.w, size.h, size.d],
      rotation: [0, radians, 0],
    })!;

    // `itemToPlan` is unit-agnostic: the size and the centre only have to
    // agree. Work in plan metres so the result is directly comparable.
    const expected = itemToPlan(size, centre[0], centre[1], degrees);
    const [wantX, wantY] = expected(0, HEADBOARD_M);

    const symbol = symbolInFootprint("bed-double", footprint.points)!;
    const endpoints = [
      ...symbol.paths.flatMap((p) => p.points),
      ...symbol.polygons.flatMap((p) => p.points),
    ];
    assert.ok(
      endpoints.some(([x, y]) => Math.abs(x - wantX) < 1e-6 && Math.abs(y - wantY) < 1e-6),
      `at ${degrees} degrees the headboard should start at (${wantX.toFixed(3)}, ${wantY.toFixed(3)}) — the symbol is placed against the wrong edge`,
    );
  }
});

test("at rotation zero a symbol's back is north of its front", () => {
  // The plain-language version of the test above, so the convention survives
  // a refactor of either implementation.
  const footprint = deriveItemFootprint({
    id: "b",
    type: "item",
    position: [0, 0, 0],
    dimensions: [1.6, 0.55, 2],
    rotation: [0, 0, 0],
  })!;
  const symbol = symbolInFootprint("bed-double", footprint.points)!;

  // The headboard line sits 60 mm from the back edge, so of all the symbol's
  // horizontal lines it is the northernmost after the outline itself.
  const ys = [
    ...symbol.polygons.flatMap((p) => p.points.map(([, y]) => y)),
    ...symbol.paths.flatMap((p) => p.points.map(([, y]) => y)),
  ];
  const headboard = symbol.paths
    .filter((p) => p.points.length === 2 && Math.abs(p.points[0]![1] - p.points[1]![1]) < 1e-9)
    .map((p) => p.points[0]![1])
    .sort((a, b) => b - a)[0]!;

  assert.ok(
    headboard > 0,
    `the headboard should sit north of centre, got y = ${headboard}`,
  );
  assert.ok(Math.abs(Math.max(...ys) - 1) < 1e-6, "the bed is 2 m deep, centred on the origin");
});
