import { test } from "node:test";
import assert from "node:assert/strict";

import { deriveItemFootprint, deriveOpening, wallGeometry } from "./derive-openings.ts";
import { derivePlanLevels } from "./derive-plan.ts";
import { INK, PEN } from "./pens.ts";
import type { SceneNodeLike, SceneNodes } from "./plan-types.ts";

/** A 6 m wall along +x at y = 0, 150 mm thick. */
const WALL: SceneNodeLike = {
  id: "wall_0",
  type: "wall",
  parentId: "level_0",
  start: [0, 0],
  end: [6, 0],
  thickness: 0.15,
};

function distance(a: readonly [number, number], b: readonly [number, number]): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

test("wall geometry gives a unit axis and normal", () => {
  const g = wallGeometry(WALL)!;
  assert.ok(Math.abs(g.length - 6) < 1e-9);
  assert.ok(Math.abs(Math.hypot(...g.axis) - 1) < 1e-9);
  assert.ok(Math.abs(Math.hypot(...g.normal) - 1) < 1e-9);
  // Normal is perpendicular to the axis.
  assert.ok(Math.abs(g.axis[0] * g.normal[0] + g.axis[1] * g.normal[1]) < 1e-9);
  assert.equal(wallGeometry({ id: "w", start: [1, 1], end: [1, 1] }), null);
});

test("a door sits where its offset says, measured from the wall start", () => {
  // position[0] is metres from wall.start — Pascal's own wall-topology
  // convention. A 0.9 m door centred at 2.0 m spans 1.55 → 2.45.
  const opening = deriveOpening(
    { id: "d1", type: "door", wallId: "wall_0", width: 0.9, position: [2, 0, 0] },
    WALL,
    { showMarks: false },
  )!;

  const xs = opening.knockOut.points.map(([x]) => x);
  assert.ok(Math.abs(Math.min(...xs) - 1.55) < 1e-6, `left edge ${Math.min(...xs)}`);
  assert.ok(Math.abs(Math.max(...xs) - 2.45) < 1e-6, `right edge ${Math.max(...xs)}`);
});

test("the knock-out spans the full wall thickness and clears its outline", () => {
  const opening = deriveOpening(
    { id: "d1", type: "door", wallId: "wall_0", width: 1, position: [3, 0, 0] },
    WALL,
    { showMarks: false },
  )!;

  const ys = opening.knockOut.points.map(([, y]) => y);
  const span = Math.max(...ys) - Math.min(...ys);
  // 150 mm wall plus a sliver each side so the wall's own 0.5 mm stroke does
  // not leave a hairline drawn across the opening.
  assert.ok(span > 0.15, `span ${span} must exceed the wall thickness`);
  assert.ok(span < 0.16, `span ${span} must not overshoot visibly`);
  assert.equal(opening.knockOut.fill, INK.paper, "knock-out paints in the sheet colour");
});

test("jambs are drawn across the wall at both edges of the opening", () => {
  const opening = deriveOpening(
    { id: "d1", type: "door", wallId: "wall_0", width: 0.8, position: [2, 0, 0] },
    WALL,
    { showMarks: false },
  )!;

  const jambs = opening.paths.filter((p) => p.weightMm === PEN.opening && p.points.length === 2);
  assert.ok(jambs.length >= 2, "two jamb faces");

  // Each jamb is exactly one wall thickness long.
  const crossing = jambs.filter((p) => Math.abs(distance(p.points[0]!, p.points[1]!) - 0.15) < 1e-6);
  assert.equal(crossing.length, 2, "both jambs span the wall thickness");

  const jambXs = crossing.map((p) => p.points[0]![0]).sort((a, b) => a - b);
  assert.ok(Math.abs(jambXs[0]! - 1.6) < 1e-6);
  assert.ok(Math.abs(jambXs[1]! - 2.4) < 1e-6);
});

test("a door draws a leaf and a swing arc, a window draws sill lines", () => {
  const door = deriveOpening(
    { id: "d1", type: "door", wallId: "wall_0", width: 0.9, position: [2, 0, 0] },
    WALL,
    { showMarks: false },
  )!;
  assert.ok(
    door.paths.some((p) => p.points.length > 4),
    "door has a swing arc",
  );

  const window = deriveOpening(
    { id: "w1", type: "window", wallId: "wall_0", width: 1.2, position: [3, 0, 0] },
    WALL,
    { showMarks: false },
  )!;
  assert.ok(!window.paths.some((p) => p.points.length > 4), "a window has no swing arc");
  const sills = window.paths.filter(
    (p) => p.weightMm === PEN.symbol && Math.abs(distance(p.points[0]!, p.points[1]!) - 1.2) < 1e-6,
  );
  assert.equal(sills.length, 3, "three lines across the reveal");
});

test("the swing arc is a true quarter circle at the leaf radius", () => {
  const door = deriveOpening(
    { id: "d1", type: "door", wallId: "wall_0", width: 0.9, position: [2, 0, 0] },
    WALL,
    { showMarks: false },
  )!;
  const arc = door.paths.find((p) => p.points.length > 4)!;
  // Hinged at the opening's start edge: 2.0 m centre minus half of 0.9 m.
  const hinge: readonly [number, number] = [1.55, 0];
  for (const point of arc.points) {
    assert.ok(
      Math.abs(distance(hinge, point) - 0.9) < 1e-6,
      `arc point ${JSON.stringify(point)} is not 0.9 m from the hinge`,
    );
  }
});

test("an opening carries its type tag when marks are on", () => {
  const withMark = deriveOpening(
    { id: "d1", type: "door", wallId: "wall_0", width: 0.9, position: [2, 0, 0], mark: "D03" },
    WALL,
    { showMarks: true },
  )!;
  assert.equal(withMark.label?.text, "D03");

  const withoutMarks = deriveOpening(
    { id: "d1", type: "door", wallId: "wall_0", width: 0.9, position: [2, 0, 0], mark: "D03" },
    WALL,
    { showMarks: false },
  )!;
  assert.equal(withoutMarks.label, null);
});

test("an opening wider than its wall is clamped to the wall", () => {
  const opening = deriveOpening(
    { id: "d1", type: "door", wallId: "wall_0", width: 20, position: [3, 0, 0] },
    WALL,
    { showMarks: false },
  )!;
  const xs = opening.knockOut.points.map(([x]) => x);
  assert.ok(Math.min(...xs) >= -1e-9, "cannot start before the wall");
  assert.ok(Math.max(...xs) <= 6 + 1e-9, "cannot run past the wall end");
});

test("furniture footprints follow position, size and rotation", () => {
  const unrotated = deriveItemFootprint({
    id: "i1",
    type: "item",
    position: [2, 0, 3],
    dimensions: [2, 0.8, 1],
    rotation: [0, 0, 0],
  })!;
  const xs = unrotated.points.map(([x]) => x);
  const ys = unrotated.points.map(([, y]) => y);
  assert.ok(Math.abs(Math.max(...xs) - Math.min(...xs) - 2) < 1e-6, "2 m wide");
  assert.ok(Math.abs(Math.max(...ys) - Math.min(...ys) - 1) < 1e-6, "1 m deep");
  assert.equal(unrotated.weightMm, PEN.seen, "furniture is below the cut plane");
  assert.equal(unrotated.fill, undefined, "furniture is an outline, not poché");

  // A quarter turn swaps the footprint's extents.
  const rotated = deriveItemFootprint({
    id: "i2",
    type: "item",
    position: [2, 0, 3],
    dimensions: [2, 0.8, 1],
    rotation: [0, Math.PI / 2, 0],
  })!;
  const rxs = rotated.points.map(([x]) => x);
  const rys = rotated.points.map(([, y]) => y);
  assert.ok(Math.abs(Math.max(...rxs) - Math.min(...rxs) - 1) < 1e-6, "now 1 m across");
  assert.ok(Math.abs(Math.max(...rys) - Math.min(...rys) - 2) < 1e-6, "now 2 m deep");
});

test("furniture without size or position is skipped, not drawn at the origin", () => {
  assert.equal(deriveItemFootprint({ id: "i", type: "item" }), null);
  assert.equal(deriveItemFootprint({ id: "i", type: "item", position: [1, 0, 1] }), null);
  assert.equal(
    deriveItemFootprint({ id: "i", type: "item", position: [1, 0, 1], dimensions: [0, 0, 0] }),
    null,
  );
});

test("a level assembles walls, openings and furniture together", () => {
  const nodes: SceneNodes = {
    level_0: { id: "level_0", type: "level", name: "Ground", baseElevation: 0 },
    wall_0: WALL,
    wall_1: { id: "wall_1", type: "wall", parentId: "level_0", start: [6, 0], end: [6, 4], thickness: 0.15 },
    wall_2: { id: "wall_2", type: "wall", parentId: "level_0", start: [6, 4], end: [0, 4], thickness: 0.15 },
    wall_3: { id: "wall_3", type: "wall", parentId: "level_0", start: [0, 4], end: [0, 0], thickness: 0.15 },
    d1: { id: "d1", type: "door", parentId: "level_0", wallId: "wall_0", width: 0.9, position: [2, 0, 0], mark: "D01" },
    w1: { id: "w1", type: "window", parentId: "level_0", wallId: "wall_2", width: 1.2, position: [3, 0, 0], mark: "W01" },
    sofa: {
      id: "sofa",
      type: "item",
      parentId: "level_0",
      position: [3, 0, 2],
      dimensions: [2, 0.8, 0.9],
      rotation: [0, 0, 0],
    },
  };

  const [level] = derivePlanLevels(nodes);
  assert.ok(level);
  assert.equal(level!.wallCount, 4);
  assert.equal(level!.openingCount, 2);
  assert.equal(level!.itemCount, 1);
  assert.equal(level!.drawing.knockOuts.length, 2);

  const marks = level!.drawing.labels.map((l) => l.text);
  assert.ok(marks.includes("D01"));
  assert.ok(marks.includes("W01"));

  // The bounds come from the walls only — a sofa must not stretch the sheet.
  assert.ok(Math.abs(level!.bounds.maxX - 6.075) < 1e-6);
});

test("an opening whose wall is missing is dropped rather than drawn adrift", () => {
  const nodes: SceneNodes = {
    level_0: { id: "level_0", type: "level", name: "Ground", baseElevation: 0 },
    wall_0: WALL,
    wall_1: { id: "wall_1", type: "wall", parentId: "level_0", start: [6, 0], end: [6, 4], thickness: 0.15 },
    wall_2: { id: "wall_2", type: "wall", parentId: "level_0", start: [6, 4], end: [0, 4], thickness: 0.15 },
    wall_3: { id: "wall_3", type: "wall", parentId: "level_0", start: [0, 4], end: [0, 0], thickness: 0.15 },
    orphan: { id: "orphan", type: "door", parentId: "level_0", wallId: "missing", width: 0.9, position: [1, 0, 0] },
  };

  const [level] = derivePlanLevels(nodes);
  assert.equal(level!.openingCount, 0);
  assert.equal(level!.drawing.knockOuts.length, 0);
});

test("furniture can be turned off without affecting walls", () => {
  const nodes: SceneNodes = {
    level_0: { id: "level_0", type: "level", name: "Ground", baseElevation: 0 },
    wall_0: WALL,
    wall_1: { id: "wall_1", type: "wall", parentId: "level_0", start: [6, 0], end: [6, 4], thickness: 0.15 },
    wall_2: { id: "wall_2", type: "wall", parentId: "level_0", start: [6, 4], end: [0, 4], thickness: 0.15 },
    wall_3: { id: "wall_3", type: "wall", parentId: "level_0", start: [0, 4], end: [0, 0], thickness: 0.15 },
    sofa: {
      id: "sofa",
      type: "item",
      parentId: "level_0",
      position: [3, 0, 2],
      dimensions: [2, 0.8, 0.9],
      rotation: [0, 0, 0],
    },
  };

  const [on] = derivePlanLevels(nodes, { furniture: true });
  const [off] = derivePlanLevels(nodes, { furniture: false });
  assert.equal(on!.itemCount, 1);
  assert.equal(off!.itemCount, 0);
  assert.equal(off!.wallCount, on!.wallCount);
});
