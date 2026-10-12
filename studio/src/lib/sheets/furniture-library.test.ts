import { test } from "node:test";
import assert from "node:assert/strict";

import {
  FURNITURE,
  FURNITURE_BY_ID,
  checkFootprint,
  flattenSymbol,
  furnitureSymbol,
  itemToPlan,
  normaliseSize,
  thumbnailSvg,
  type FurnitureType,
  type Size,
} from "./furniture-library.ts";

/**
 * A deterministic generator, so a fuzz failure can be reproduced from the
 * message alone rather than only showing up one run in twenty.
 */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

test("every plan symbol stays inside its own footprint", () => {
  // The default sweep: smallest, largest and as-shipped.
  assert.deepEqual(checkFootprint(), []);
});

test("and stays inside it at any size the item allows", () => {
  // The interesting failures are between the limits, not at them: a detail
  // sized off the width overflows a footprint that is wide and shallow long
  // before it overflows the declared maximum. This is the check that caught
  // the office chair's base.
  const random = seeded(20261012);
  const between = (lo: number, hi: number) => lo + random() * (hi - lo);

  const failures = checkFootprint((item) =>
    Array.from({ length: 50 }, () => ({
      w: between(item.min.w, item.max.w),
      d: between(item.min.d, item.max.d),
      h: between(item.min.h, item.max.h),
    })),
  );

  assert.deepEqual(failures, [], `symbols left their footprint:\n  ${failures.join("\n  ")}`);
});

test("extreme aspect ratios do not burst the outline", () => {
  // Deliberately pathological: widest-and-shallowest, then its transpose.
  const corners = (item: FurnitureType): Size[] => [
    { w: item.max.w, d: item.min.d, h: item.min.h },
    { w: item.min.w, d: item.max.d, h: item.max.h },
    { w: item.max.w, d: item.min.d, h: item.max.h },
    { w: item.min.w, d: item.max.d, h: item.min.h },
  ];
  assert.deepEqual(checkFootprint(corners), []);
});

test("the catalogue is internally consistent", () => {
  const ids = FURNITURE.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length, "ids are unique");
  assert.equal(FURNITURE_BY_ID.size, FURNITURE.length);

  for (const item of FURNITURE) {
    for (const axis of ["w", "d", "h"] as const) {
      assert.ok(item.min[axis] <= item.max[axis], `${item.id}: min.${axis} exceeds max.${axis}`);
      assert.ok(
        item.defaults[axis] >= item.min[axis] && item.defaults[axis] <= item.max[axis],
        `${item.id}: defaults.${axis} (${item.defaults[axis]}) is outside min/max`,
      );
    }
    assert.ok(item.label.trim().length > 0, `${item.id} has a label`);
    assert.ok(item.plan(item.defaults).length > 0, `${item.id} draws something`);
    assert.ok(item.solids(item.defaults).length > 0, `${item.id} has a body`);
  }
});

test("a requested size is clamped, and round tables stay round", () => {
  const chair = FURNITURE_BY_ID.get("office-chair")!;
  assert.equal(normaliseSize(chair, { w: 10 }).w, chair.min.w, "clamped up to the minimum");
  assert.equal(normaliseSize(chair, { w: 99_999 }).w, chair.max.w, "clamped down to the maximum");

  const round = FURNITURE_BY_ID.get("table-round")!;
  const sized = normaliseSize(round, { w: 900, d: 400 });
  assert.equal(sized.d, sized.w, "keepSquare wins over the requested depth");
});

test("a label that will not fit is dropped, never squeezed", () => {
  const printer = FURNITURE_BY_ID.get("printer-mfd")!;

  const big = furnitureSymbol("printer-mfd", printer.defaults, 20);
  assert.ok(
    big.texts.some((t) => t.text === "PRINTER"),
    "at 1:20 the label fits and is drawn",
  );

  const small = furnitureSymbol("printer-mfd", printer.defaults, 200);
  assert.deepEqual(small.texts, [], "at 1:200 nothing is drawn");
  assert.deepEqual(small.dropped, ["PRINTER"], "and the caller is told which label went");
});

test("an unknown id is refused rather than silently drawing nothing", () => {
  assert.throws(() => furnitureSymbol("chaise-longue", {}, 50), /Unknown furniture type/);
  assert.throws(() => thumbnailSvg("chaise-longue"), /Unknown furniture type/);
});

test("the whole catalogue of thumbnails is small enough to inline", () => {
  // The point of drawing furniture from code is that the catalogue costs
  // nothing to ship. Pin that: 33 pieces of real SVG, no image files.
  const svgs = FURNITURE.map((item) => thumbnailSvg(item.id));
  for (const [index, svg] of svgs.entries()) {
    assert.ok(svg.startsWith("<svg "), `${FURNITURE[index]!.id} produced no svg`);
    assert.ok(svg.endsWith("</svg>"), `${FURNITURE[index]!.id} produced a truncated svg`);
    assert.ok(svg.includes("<path "), `${FURNITURE[index]!.id} drew no geometry`);
  }

  const totalBytes = svgs.reduce((sum, svg) => sum + Buffer.byteLength(svg, "utf8"), 0);
  assert.ok(
    totalBytes < 40_000,
    `the catalogue's thumbnails total ${totalBytes} bytes — if this grew a lot, check for an accidental image`,
  );
});

test("an item's back edge faces up the page at rotation zero", () => {
  // The convention every symbol is authored against: local y = 0 is the side
  // that goes against the wall, and at rotation 0 that is north.
  const size: Size = { w: 1000, d: 400, h: 750 };
  const at0 = itemToPlan(size, 0, 0, 0);

  const [, backY] = at0(500, 0);
  const [, frontY] = at0(500, 400);
  assert.ok(backY > frontY, "the back edge is further up the page than the front");
  assert.ok(Math.abs(backY - 200) < 1e-9, "and sits half the depth above the centre");

  // A quarter turn anticlockwise puts the back edge to the west.
  const at90 = itemToPlan(size, 0, 0, 90);
  const [backX] = at90(500, 0);
  assert.ok(backX < 0, `a 90 degree turn faces the back west, got x = ${backX}`);
});

test("a rounded rect and an ellipse close on themselves", () => {
  const flat = flattenSymbol(
    [
      { kind: "rect", x: 0, y: 0, w: 100, h: 50, r: 10, pen: "outline" },
      { kind: "ellipse", cx: 50, cy: 25, rx: 20, ry: 10, pen: "detail" },
    ],
    { w: 100, d: 50, h: 100 },
    50,
  );

  assert.equal(flat.strokes.length, 2);
  for (const stroke of flat.strokes) {
    assert.ok(stroke.closed, "both are closed shapes");
    const [first] = stroke.points;
    const last = stroke.points[stroke.points.length - 1]!;
    assert.ok(
      Math.hypot(last[0] - first![0], last[1] - first![1]) > 1e-9,
      "the last point does not repeat the first — closing is the renderer's job",
    );
  }
});
