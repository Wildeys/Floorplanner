import { test } from "node:test";
import assert from "node:assert/strict";

import {
  boundsExtent,
  derivePlanLevels,
  deriveWallPolygons,
  findLevelAncestor,
  polygonArea,
  polygonCentroid,
  type SceneNodes,
} from "./derive-plan.ts";

/** A rectangular room of `w` × `h` metres as four connected walls. */
function roomWalls(w: number, h: number, thickness = 0.15, prefix = "wall") {
  const corners: [number, number][] = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];
  return corners.map((start, index) => ({
    id: `${prefix}_${index}`,
    type: "wall" as const,
    parentId: "level_0",
    start,
    end: corners[(index + 1) % corners.length]!,
    thickness,
  }));
}

function sceneOf(nodes: readonly { id: string }[]): SceneNodes {
  return Object.fromEntries(nodes.map((n) => [n.id, n])) as SceneNodes;
}

test("polygon area and centroid are correct", () => {
  const square = [
    [0, 0],
    [4, 0],
    [4, 3],
    [0, 3],
  ] as const;
  assert.equal(polygonArea(square), 12);
  const [cx, cy] = polygonCentroid(square);
  assert.ok(Math.abs(cx - 2) < 1e-9);
  assert.ok(Math.abs(cy - 1.5) < 1e-9);

  // Winding direction must not flip the sign of the area.
  assert.equal(polygonArea([...square].reverse()), 12);
  // Degenerate input is survivable, not a crash.
  assert.equal(polygonArea([[0, 0]]), 0);
});

test("wall polygons come back mitred from core", () => {
  const walls = roomWalls(5, 4);
  const polygons = deriveWallPolygons(walls);

  assert.equal(polygons.length, 4, "one polygon per wall");
  for (const polygon of polygons) {
    assert.ok(polygon.points.length >= 4, "a wall footprint is at least a quad");
    // Block masonry, as sheet A.02 draws it and as its legend labels it —
    // cross-hatched, not filled. Solid black is reserved for columns.
    assert.equal(polygon.fill, undefined, "a cut wall is hatched, not filled");
    assert.equal(polygon.hatch?.angleDeg, 45, "cut walls carry the masonry hatch");
    assert.notEqual(polygon.hatch?.crossed, false, "and it is a cross-hatch");
  }

  // A profile whose convention is poché can still ask for it.
  for (const polygon of deriveWallPolygons(walls, "solid")) {
    assert.equal(polygon.fill, "#1a1a1a");
    assert.equal(polygon.hatch, undefined);
  }

  // A mitred 5 m wall on a 0.15 m thick rectangle reaches the outer corners,
  // so its footprint spans the full outer width rather than stopping at the
  // centreline. That is the whole point of using core's mitring.
  const xs = polygons.flatMap((p) => p.points.map(([x]) => x));
  const span = Math.max(...xs) - Math.min(...xs);
  assert.ok(
    Math.abs(span - 5.15) < 1e-6,
    `outer span should be 5 + thickness = 5.15, got ${span}`,
  );
});

test("walls with no geometry are skipped rather than crashing", () => {
  const polygons = deriveWallPolygons([
    { id: "w1", type: "wall", parentId: "level_0" },
    // Zero-length wall: degenerate, must not produce a polygon.
    { id: "w2", type: "wall", parentId: "level_0", start: [1, 1], end: [1, 1], thickness: 0.1 },
  ]);
  assert.deepEqual(polygons, []);
});

test("findLevelAncestor climbs past intermediate parents", () => {
  const nodes = sceneOf([
    { id: "level_0", type: "level", name: "Ground" },
    { id: "group_1", type: "group", parentId: "level_0" },
    { id: "wall_9", type: "wall", parentId: "group_1", start: [0, 0], end: [1, 0] },
    { id: "orphan", type: "wall", parentId: null, start: [0, 0], end: [1, 0] },
  ] as never[]);
  const levelIds = new Set(["level_0"]);

  // A one-step parent check would miss this wall and silently drop it.
  assert.equal(findLevelAncestor(nodes, "wall_9", levelIds), "level_0");
  assert.equal(findLevelAncestor(nodes, "orphan", levelIds), null);
});

test("a parent cycle terminates instead of hanging", () => {
  const nodes = sceneOf([
    { id: "a", type: "wall", parentId: "b" },
    { id: "b", type: "wall", parentId: "a" },
  ] as never[]);
  assert.equal(findLevelAncestor(nodes, "a", new Set(["level_0"])), null);
});

test("levels derive in elevation order with room labels and areas", () => {
  const nodes = sceneOf([
    { id: "level_1", type: "level", name: "First", baseElevation: 3 },
    { id: "level_0", type: "level", name: "Ground", baseElevation: 0 },
    ...roomWalls(6, 4, 0.15, "g"),
    ...roomWalls(6, 4, 0.15, "f").map((w) => ({ ...w, parentId: "level_1" })),
    {
      id: "zone_0",
      type: "zone",
      parentId: "level_0",
      name: "Living",
      polygon: [
        [0, 0],
        [6, 0],
        [6, 4],
        [0, 4],
      ],
    },
  ] as never[]);

  const levels = derivePlanLevels(nodes);
  assert.equal(levels.length, 2);
  assert.equal(levels[0]!.name, "Ground", "lowest storey first");
  assert.equal(levels[1]!.name, "First");

  assert.equal(levels[0]!.wallCount, 4);
  assert.ok(Math.abs(levels[0]!.floorAreaM2 - 24) < 1e-9);

  const labels = levels[0]!.drawing.labels;
  const tag = labels.find((l) => l.text === "LIVING");
  assert.ok(tag, "the room carries a name tag");
  assert.equal(tag!.shape, "box", "boxed, as the reference sheets draw it");
  // The area still reaches the schedules through floorAreaM2 above, but it is
  // not printed on the plan: it lands on the furniture, and for a zone that
  // covers only part of a room it reads as a wrong room area.
  assert.ok(
    !labels.some((l) => l.text.includes("m²")),
    `no area figure on the plan, got ${labels.map((l) => l.text).join(", ")}`,
  );

  // The upper storey has no zone, so no area and no room tag.
  assert.equal(levels[1]!.floorAreaM2, 0);
  assert.equal(levels[1]!.drawing.labels.length, 0);
});

test("levels without wall geometry are dropped, not emitted blank", () => {
  const nodes = sceneOf([
    { id: "level_0", type: "level", name: "Ground", baseElevation: 0 },
    { id: "level_1", type: "level", name: "Empty", baseElevation: 3 },
    ...roomWalls(4, 4),
  ] as never[]);

  const levels = derivePlanLevels(nodes);
  assert.equal(levels.length, 1, "a blank sheet reads as an omission");
  assert.equal(levels[0]!.name, "Ground");
});

test("hidden nodes are excluded from the drawing", () => {
  const nodes = sceneOf([
    { id: "level_0", type: "level", name: "Ground", baseElevation: 0 },
    ...roomWalls(4, 4),
    { id: "wall_hidden", type: "wall", parentId: "level_0", start: [10, 10], end: [14, 10], thickness: 0.15, visible: false },
  ] as never[]);

  const levels = derivePlanLevels(nodes);
  assert.equal(levels[0]!.wallCount, 4, "hidden wall must not be counted");
  const { width } = boundsExtent(levels[0]!.bounds);
  assert.ok(width < 5, `hidden wall must not stretch the bounds, got ${width}`);
});

test("bounds cover the mitred outer face of the plan", () => {
  const nodes = sceneOf([
    { id: "level_0", type: "level", name: "Ground", baseElevation: 0 },
    ...roomWalls(10, 6, 0.2),
  ] as never[]);

  const { width, height } = boundsExtent(derivePlanLevels(nodes)[0]!.bounds);
  assert.ok(Math.abs(width - 10.2) < 1e-6, `width ${width}`);
  assert.ok(Math.abs(height - 6.2) < 1e-6, `height ${height}`);
});
