import { test } from "node:test";
import assert from "node:assert/strict";

import { assignOpeningMarks } from "./opening-marks.ts";
import { deriveItemFootprint, itemDimensions } from "./derive-openings.ts";
import type { SceneNodeLike } from "./plan-types.ts";

function door(id: string, width: number, height = 2.1, name?: string): SceneNodeLike {
  return { id, type: "door", width, height, name };
}
function window_(id: string, width: number, height = 1.5): SceneNodeLike {
  return { id, type: "window", width, height };
}

test("identical openings share one mark and are counted", () => {
  // Three identical doors are one type with a quantity of three — not
  // "Door 1", "Door 2", "Door 3", which cannot be scheduled.
  const marks = assignOpeningMarks([
    door("d1", 0.8, 2.1, "Door 1"),
    door("d2", 0.8, 2.1, "Door 2"),
    door("d3", 0.8, 2.1, "Door 3"),
  ]);

  assert.equal(marks.doors.length, 1, "one type");
  assert.equal(marks.doors[0]!.quantity, 3);
  assert.equal(marks.doors[0]!.mark, "D01");
  for (const id of ["d1", "d2", "d3"]) {
    assert.equal(marks.byNodeId.get(id), "D01");
  }
});

test("different sizes get different marks, numbered narrowest first", () => {
  const marks = assignOpeningMarks([
    door("wide", 1.2),
    door("narrow", 0.7),
    door("mid", 0.9),
  ]);
  assert.deepEqual(
    marks.doors.map((d) => [d.mark, d.widthMm]),
    [
      ["D01", 700],
      ["D02", 900],
      ["D03", 1200],
    ],
  );
});

test("height distinguishes a type, not just width", () => {
  const marks = assignOpeningMarks([door("a", 0.9, 2.1), door("b", 0.9, 2.4)]);
  assert.equal(marks.doors.length, 2, "same width, different height is a second type");
});

test("doors and windows are numbered in separate series", () => {
  const marks = assignOpeningMarks([door("d", 0.9), window_("w", 1.5)]);
  assert.equal(marks.byNodeId.get("d"), "D01");
  assert.equal(marks.byNodeId.get("w"), "W01");
});

test("marks are stable across exports regardless of node order", () => {
  const nodes = [door("d1", 0.8), door("d2", 1.2), window_("w1", 1.5)];
  const forward = assignOpeningMarks(nodes);
  const reversed = assignOpeningMarks([...nodes].reverse());
  // A set whose tags shuffle between exports is not reviewable.
  assert.deepEqual([...forward.byNodeId], [...reversed.byNodeId]);
});

test("a float-noisy width does not split a type", () => {
  const marks = assignOpeningMarks([door("a", 0.9), door("b", 0.9000001)]);
  assert.equal(marks.doors.length, 1, "rounded to the millimetre");
  assert.equal(marks.doors[0]!.quantity, 2);
});

test("an opening with no declared size still gets a mark", () => {
  const marks = assignOpeningMarks([{ id: "d", type: "door" }]);
  assert.equal(marks.byNodeId.get("d"), "D01");
  assert.equal(marks.doors[0]!.widthMm, 900, "falls back to a sensible default");
});

test("catalogue items take their size from the asset and scale", () => {
  // This is the shape a real placed item has: no top-level `dimensions`.
  const placed: SceneNodeLike = {
    id: "sofa",
    type: "item",
    position: [2, 0, 3],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    asset: { dimensions: [2.1, 0.8, 0.95] },
  };

  const size = itemDimensions(placed);
  assert.ok(size, "a catalogue item must report a size");
  assert.ok(Math.abs(size![0]! - 2.1) < 1e-9);
  assert.ok(Math.abs(size![2]! - 0.95) < 1e-9);

  const footprint = deriveItemFootprint(placed);
  assert.ok(footprint, "and must produce a footprint");
  const xs = footprint!.points.map(([x]) => x);
  assert.ok(Math.abs(Math.max(...xs) - Math.min(...xs) - 2.1) < 1e-6);
});

test("a scaled catalogue item reports its scaled size", () => {
  const size = itemDimensions({
    id: "i",
    type: "item",
    position: [0, 0, 0],
    scale: [2, 1, 0.5],
    asset: { dimensions: [1, 1, 1] },
  });
  assert.ok(Math.abs(size![0]! - 2) < 1e-9);
  assert.ok(Math.abs(size![2]! - 0.5) < 1e-9);
});

test("a hand-built item with plain dimensions still works", () => {
  const size = itemDimensions({
    id: "i",
    type: "item",
    position: [0, 0, 0],
    dimensions: [1.5, 0.5, 0.7],
  });
  assert.deepEqual([...size!], [1.5, 0.5, 0.7]);
});
