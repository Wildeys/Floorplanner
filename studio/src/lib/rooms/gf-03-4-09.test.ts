import { test } from "node:test";
import assert from "node:assert/strict";

import { faceDegToRotationY } from "./gf-03-4-09.ts";

/** Where an item at this rotation faces, as a unit vector in plan (x east, y north). */
function facing(rotationY: number): [number, number] {
  // An item's front is its local +Z. three's rotateY sends local (0, 1) in
  // (x, z) to (sin t, cos t); plan y = -z, so the page direction is
  // (sin t, -cos t).
  return [Math.sin(rotationY), -Math.cos(rotationY)];
}

test("a compass bearing turns into the rotation that actually faces that way", () => {
  const compass: Record<string, [number, number]> = {
    north: [0, 1],
    east: [1, 0],
    south: [0, -1],
    west: [-1, 0],
  };
  const bearings: Record<string, number> = { north: 0, east: 90, south: 180, west: 270 };

  for (const [name, bearing] of Object.entries(bearings)) {
    const [fx, fy] = facing(faceDegToRotationY(bearing));
    const [wx, wy] = compass[name]!;
    assert.ok(
      Math.abs(fx - wx) < 1e-9 && Math.abs(fy - wy) < 1e-9,
      `faceDeg ${bearing} (${name}) should face [${wx}, ${wy}], got [${fx.toFixed(3)}, ${fy.toFixed(3)}]`,
    );
  }
});

test("the bearing that bit us is the north-south pair, not east-west", () => {
  // Assigning faceDeg straight across as radians is right for 90 and 270 and a
  // half turn out for 0 and 180 — which is why the room looked fine until the
  // storage units, coat hooks and pantry run were checked.
  const naive = (deg: number) => (deg * Math.PI) / 180;
  const sameFacing = (a: number, b: number) => {
    const [ax, ay] = facing(a);
    const [bx, by] = facing(b);
    return Math.abs(ax - bx) < 1e-9 && Math.abs(ay - by) < 1e-9;
  };

  for (const deg of [90, 270]) {
    assert.ok(sameFacing(naive(deg), faceDegToRotationY(deg)), `${deg} was already correct`);
  }
  for (const deg of [0, 180]) {
    assert.ok(!sameFacing(naive(deg), faceDegToRotationY(deg)), `${deg} was a half turn out`);
  }
});
