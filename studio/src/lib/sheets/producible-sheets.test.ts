import assert from "node:assert/strict";
import test from "node:test";

import { MALDIVES_PROFILE } from "./jurisdiction.ts";
import type { SceneNodes } from "./derive-plan.ts";
import { customerPlanTitle, listProduciblePlanSheets } from "./sheet-set.ts";

function room(levelId: string, name: string, elevation: number): SceneNodes {
  const corners: [number, number][] = [
    [0, 0],
    [6, 0],
    [6, 4],
    [0, 4],
  ];
  const nodes: Record<string, unknown> = {
    [levelId]: { id: levelId, type: "level", name, baseElevation: elevation },
  };
  corners.forEach((start, index) => {
    const id = `${levelId}_w${index}`;
    nodes[id] = {
      id,
      type: "wall",
      parentId: levelId,
      start,
      end: corners[(index + 1) % corners.length],
      thickness: 0.15,
    };
  });
  return nodes as SceneNodes;
}

test("customer titles keep the storey and drop the capitals", () => {
  assert.equal(customerPlanTitle("Ground"), "Ground floor plan");
  assert.equal(customerPlanTitle("First"), "First floor plan");
});

test("the strip lists only storeys that can be drawn", () => {
  const nodes: SceneNodes = {
    ...room("level_0", "Ground", 0),
    level_empty: { id: "level_empty", type: "level", name: "Terrace", baseElevation: 6 },
    ...room("level_1", "First", 3),
  };
  const sheets = listProduciblePlanSheets(nodes, MALDIVES_PROFILE);
  assert.deepEqual(
    sheets.map((sheet) => sheet.code),
    ["A.01", "A.02"],
  );
  assert.equal(sheets[0]!.title, "Ground floor plan");
  assert.equal(sheets[1]!.title, "First floor plan");
});

test("the default site boundary does not stop the sheet list", () => {
  const nodes: SceneNodes = {
    ...room("level_0", "Ground", 0),
    site_0: {
      id: "site_0",
      type: "site",
      polygon: {
        type: "polygon",
        points: [
          [-15, -15],
          [15, -15],
          [15, 15],
          [-15, 15],
        ],
      },
    },
  };
  const sheets = listProduciblePlanSheets(nodes, MALDIVES_PROFILE);
  assert.deepEqual(
    sheets.map((sheet) => sheet.title),
    ["Ground floor plan"],
  );
});
