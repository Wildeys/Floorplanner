import { test } from "node:test";
import assert from "node:assert/strict";

import {
  annotationMarginMm,
  deriveDimensions,
  dimensionStations,
  gridLetter,
} from "./derive-dimensions.ts";
import { derivePlanLevels } from "./derive-plan.ts";
import { MALDIVES_PROFILE } from "./jurisdiction.ts";
import { PEN } from "./pens.ts";
import type { PlanBounds, SceneNodeLike, SceneNodes } from "./plan-types.ts";

const UNITS = MALDIVES_PROFILE.units;

/** Perimeter of a w × h rectangle, plus optional interior cross walls. */
function rectangleWalls(w: number, h: number): SceneNodeLike[] {
  const corners: [number, number][] = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];
  return corners.map((start, i) => ({
    id: `w${i}`,
    type: "wall",
    parentId: "level_0",
    start,
    end: corners[(i + 1) % corners.length]!,
    thickness: 0.15,
  }));
}

const BOUNDS: PlanBounds = { minX: 0, minY: 0, maxX: 10, maxY: 6 };

test("grid letters run past Z without repeating", () => {
  assert.equal(gridLetter(0), "A");
  assert.equal(gridLetter(5), "F");
  assert.equal(gridLetter(25), "Z");
  assert.equal(gridLetter(26), "AA");
  assert.equal(gridLetter(27), "AB");
  const seen = new Set(Array.from({ length: 60 }, (_, i) => gridLetter(i)));
  assert.equal(seen.size, 60, "every index gets a distinct label");
});

test("stations come from the building's own structural lines", () => {
  const walls: SceneNodeLike[] = [
    ...rectangleWalls(10, 6),
    // A north-south partition at x = 4 is an x station.
    { id: "p", type: "wall", parentId: "level_0", start: [4, 0], end: [4, 6], thickness: 0.1 },
    // An east-west partition at y = 2.5 is a y station.
    { id: "q", type: "wall", parentId: "level_0", start: [0, 2.5], end: [10, 2.5], thickness: 0.1 },
  ];

  const stations = dimensionStations(walls, BOUNDS);
  assert.deepEqual(stations.x, [0, 4, 10]);
  assert.deepEqual(stations.y, [0, 2.5, 6]);
});

test("near-coincident stations collapse to one", () => {
  const walls: SceneNodeLike[] = [
    ...rectangleWalls(10, 6),
    { id: "a", type: "wall", parentId: "level_0", start: [4, 0], end: [4, 6], thickness: 0.1 },
    // 2 mm away — the same line on site, not a 2 mm dimension.
    { id: "b", type: "wall", parentId: "level_0", start: [4.002, 0], end: [4.002, 6], thickness: 0.1 },
  ];
  assert.deepEqual(dimensionStations(walls, BOUNDS).x, [0, 4, 10]);
});

test("diagonal walls contribute no station", () => {
  const walls: SceneNodeLike[] = [
    ...rectangleWalls(10, 6),
    { id: "d", type: "wall", parentId: "level_0", start: [1, 1], end: [5, 4], thickness: 0.1 },
  ];
  const stations = dimensionStations(walls, BOUNDS);
  assert.deepEqual(stations.x, [0, 10], "a diagonal is not a gridline");
  assert.deepEqual(stations.y, [0, 6]);
});

test("running dimensions read the real distances, in both units", () => {
  const walls: SceneNodeLike[] = [
    ...rectangleWalls(10, 6),
    { id: "p", type: "wall", parentId: "level_0", start: [4, 0], end: [4, 6], thickness: 0.1 },
  ];
  const { labels } = deriveDimensions(walls, BOUNDS, { units: UNITS, gridBubbles: false, scale: 100 });
  const text = labels.map((l) => l.text);

  // 0 → 4 m and 4 → 10 m along the top; 0 → 6 m down the left.
  assert.ok(text.includes("4000"), "4 m bay printed in millimetres");
  assert.ok(text.includes("6000"), "6 m run printed in millimetres");
  // The overall chain measures corner to corner.
  assert.ok(text.includes("10000"), "overall width");

  // Dual units — millimetres over bracketed feet and inches (FR-1B).
  assert.ok(text.includes(`[13'-1"]`), `4000 mm in feet/inches, got ${text.join(",")}`);
  assert.ok(text.includes(`[32'-10"]`), "10000 mm in feet/inches");
});

test("dimension apparatus is drawn at the annotation weight only", () => {
  const { paths } = deriveDimensions(rectangleWalls(10, 6), BOUNDS, {
    units: UNITS,
    gridBubbles: true,
    scale: 100,
  });
  assert.ok(paths.length > 0);
  for (const path of paths) {
    assert.equal(
      path.weightMm,
      PEN.annotation,
      "dimensions must never compete with the building",
    );
  }
});

test("grid bubbles are lettered across and numbered up", () => {
  const walls: SceneNodeLike[] = [
    ...rectangleWalls(10, 6),
    { id: "p", type: "wall", parentId: "level_0", start: [4, 0], end: [4, 6], thickness: 0.1 },
  ];
  const { labels } = deriveDimensions(walls, BOUNDS, { units: UNITS, gridBubbles: true, scale: 100 });
  const text = labels.map((l) => l.text);
  assert.ok(text.includes("A") && text.includes("B") && text.includes("C"), "three x stations");
  assert.ok(text.includes("1") && text.includes("2"), "two y stations");

  const without = deriveDimensions(walls, BOUNDS, { units: UNITS, gridBubbles: false, scale: 100 });
  assert.ok(!without.labels.some((l) => l.text === "A"), "bubbles are optional");
});

test("bubbles sit outside the building, never over it", () => {
  const { paths } = deriveDimensions(rectangleWalls(10, 6), BOUNDS, {
    units: UNITS,
    gridBubbles: true,
    scale: 100,
  });
  // Circles are the long polylines; every point must clear the plan.
  const circles = paths.filter((p) => p.points.length > 10);
  assert.ok(circles.length >= 4, "a bubble per station");
  for (const circle of circles) {
    const insideBuilding = circle.points.some(
      ([x, y]) => x > BOUNDS.minX && x < BOUNDS.maxX && y > BOUNDS.minY && y < BOUNDS.maxY,
    );
    assert.equal(insideBuilding, false, "a bubble must not overlap the plan");
  }
});

test("annotation offsets are paper dimensions, not plan ones", () => {
  const walls = rectangleWalls(10, 6);
  const at100 = deriveDimensions(walls, BOUNDS, { units: UNITS, gridBubbles: true, scale: 100 });
  const at50 = deriveDimensions(walls, BOUNDS, { units: UNITS, gridBubbles: true, scale: 50 });

  const reach = (a: { paths: readonly { points: readonly (readonly [number, number])[] }[] }) =>
    Math.max(...a.paths.flatMap((p) => p.points.map(([, y]) => y))) - BOUNDS.maxY;

  // A chain sits the same distance off the building *on paper* at any scale,
  // so in plan metres it must halve when the scale doubles in size.
  const ratio = reach(at100) / reach(at50);
  assert.ok(
    Math.abs(ratio - 2) < 1e-6,
    `1:100 should reach twice as far in plan metres as 1:50, got ${ratio}`,
  );
});

test("annotation margin accounts for bubbles only when they are drawn", () => {
  // Returned in paper millimetres: the sheet engine subtracts it from the
  // viewport before choosing a scale, which is what breaks the circularity.
  assert.ok(annotationMarginMm(true) > annotationMarginMm(false));
  assert.ok(annotationMarginMm(false) > 0);
});

test("the model derivation carries the walls for the sheet to dimension", () => {
  const nodes: SceneNodes = {
    level_0: { id: "level_0", type: "level", name: "Ground", baseElevation: 0 },
    ...Object.fromEntries(rectangleWalls(10, 6).map((w) => [w.id, w])),
  };
  const [level] = derivePlanLevels(nodes);
  // Annotation is a sheet concern now, so none is produced here...
  assert.equal(level!.drawing.labels.length, 0);
  // ...but the walls travel with the level so the sheet can build it at scale.
  assert.equal(level!.walls.length, 4);
});

test("walls can be hatched instead of poché'd", () => {
  const nodes: SceneNodes = {
    level_0: { id: "level_0", type: "level", name: "Ground", baseElevation: 0 },
    ...Object.fromEntries(rectangleWalls(10, 6).map((w) => [w.id, w])),
  };

  const [solid] = derivePlanLevels(nodes, { wallFill: "solid" });
  const [hatched] = derivePlanLevels(nodes, { wallFill: "hatch" });

  const solidWall = solid!.drawing.polygons.at(-1)!;
  const hatchedWall = hatched!.drawing.polygons.at(-1)!;

  assert.ok(solidWall.fill, "solid walls carry a flat fill");
  assert.equal(solidWall.hatch, undefined);

  assert.equal(hatchedWall.fill, undefined, "hatch replaces the flat fill");
  assert.ok(hatchedWall.hatch, "hatched walls carry a pattern");
  assert.equal(hatchedWall.hatch!.angleDeg, 45);
});

test("dimensions read centreline to centreline, not to the outer face", () => {
  // The bounds passed in are the mitred outer face, half a wall thickness
  // outside the perimeter centrelines. Measuring to those would add 75 mm to
  // each end bay and print a spurious sliver at every edge.
  const walls = rectangleWalls(10, 6);
  const outer: PlanBounds = { minX: -0.075, minY: -0.075, maxX: 10.075, maxY: 6.075 };

  const stations = dimensionStations(walls, outer);
  assert.deepEqual(stations.x, [0, 10], "centrelines, not the outer face");
  assert.deepEqual(stations.y, [0, 6]);

  const { labels } = deriveDimensions(walls, outer, { units: UNITS, gridBubbles: false, scale: 100 });
  const readings = labels.map((l) => l.text).filter((t) => /^\d+$/.test(t));
  assert.ok(readings.includes("10000"), `overall should read 10000, got ${readings.join(",")}`);
  assert.ok(
    readings.every((r) => Number(r) > 100),
    `no sliver dimensions, got ${readings.join(",")}`,
  );
});

test("the reference building's bay chain reproduces exactly", () => {
  // Grid A→F on sheet A.01: 3823 + 3808 + 3808 + 3808 + 3845 = 19092.
  const bays = [3823, 3808, 3808, 3808, 3845];
  const walls: SceneNodeLike[] = [];
  let x = 0;
  walls.push({ id: "g0", type: "wall", parentId: "level_0", start: [0, 0], end: [0, 8.487], thickness: 0.15 });
  for (const [i, bay] of bays.entries()) {
    x += bay / 1000;
    walls.push({
      id: `g${i + 1}`,
      type: "wall",
      parentId: "level_0",
      start: [x, 0],
      end: [x, 8.487],
      thickness: 0.15,
    });
  }

  const outer: PlanBounds = { minX: -0.075, minY: -0.075, maxX: 19.167, maxY: 8.562 };
  const { labels } = deriveDimensions(walls, outer, { units: UNITS, gridBubbles: true, scale: 100 });
  const readings = labels.map((l) => l.text);

  for (const bay of bays) {
    assert.ok(readings.includes(String(bay)), `bay ${bay} should be dimensioned`);
  }
  assert.ok(readings.includes("19092"), "overall reads the reference's 19092");
  // Six gridlines, lettered A to F, exactly as the reference sheet.
  assert.ok(readings.includes("F"), "six x stations, A through F");
  assert.ok(!readings.includes("G"), "and no seventh");
});

test("a plan with too few axis-aligned walls falls back to its bounds", () => {
  const diagonalOnly: SceneNodeLike[] = [
    { id: "d", type: "wall", parentId: "level_0", start: [0, 0], end: [5, 4], thickness: 0.1 },
  ];
  const stations = dimensionStations(diagonalOnly, BOUNDS);
  assert.deepEqual(stations.x, [BOUNDS.minX, BOUNDS.maxX], "still dimensionable");
  assert.deepEqual(stations.y, [BOUNDS.minY, BOUNDS.maxY]);
});
