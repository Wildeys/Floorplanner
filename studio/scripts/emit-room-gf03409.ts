/**
 * Emits the A.01 plan for room GF-03.4.09 from the issued fit-out spec.
 *
 *   npm run emit:room
 *
 * Everything dimensional comes from `src/lib/rooms/gf-03-4-09.spec.json` via
 * the room module; this script only wraps those shapes in scene nodes and
 * hands them to the sheet pipeline. Print at 100% to check 1:50.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  AREA_M2,
  CEILING,
  FURNITURE,
  OPENINGS,
  ROOM_ID,
  WALLS,
  ZONES,
} from "../src/lib/rooms/gf-03-4-09.ts";
import { derivePlanLevels, type SceneNodes } from "../src/lib/sheets/derive-plan.ts";
import { MALDIVES_PROFILE, type ProjectMetadata } from "../src/lib/sheets/jurisdiction.ts";
import { renderSheetSet } from "../src/lib/sheets/sheet-set.ts";

const LEVEL = "level_gf";

const PROJECT: ProjectMetadata = {
  projectName: `${ROOM_ID} office fit-out`,
  client: "-",
  date: "11-10-2026",
  projectNo: ROOM_ID,
  firmName: "-",
  firmDiscipline: "ARCHITECTS, PLANNERS & ENGINEERS.",
};

type Node = Record<string, unknown>;

function buildScene(): SceneNodes {
  const nodes: Node[] = [
    { id: LEVEL, type: "level", name: "Ground", baseElevation: 0, height: 2.7 },
  ];

  for (const wall of WALLS) {
    nodes.push({
      id: wall.id,
      type: "wall",
      parentId: LEVEL,
      start: wall.start,
      end: wall.end,
      thickness: wall.thickness,
    });
  }

  for (const opening of OPENINGS) {
    nodes.push({
      id: opening.id,
      type: opening.type,
      parentId: LEVEL,
      wallId: opening.wallId,
      width: opening.width,
      height: opening.height,
      position: [opening.along, 0, 0],
      hingesSide: opening.hingesSide,
      swingDirection: opening.swingDirection,
    });
  }

  for (const piece of FURNITURE) {
    nodes.push({
      id: piece.id,
      type: "item",
      parentId: LEVEL,
      name: piece.name,
      position: [piece.x, 0, piece.z],
      dimensions: [piece.w, piece.h, piece.d],
      rotation: [0, 0, 0],
    });
  }

  for (const zone of ZONES) {
    nodes.push({ id: zone.id, type: "zone", parentId: LEVEL, name: zone.name, polygon: zone.polygon });
  }

  const map: Record<string, Node> = {};
  for (const node of nodes) map[node.id as string] = node;
  return map as SceneNodes;
}

async function main(): Promise<void> {
  const levels = derivePlanLevels(buildScene());
  const { pdf, sheets } = await renderSheetSet({
    profile: MALDIVES_PROFILE,
    project: PROJECT,
    levels,
    watermark: "PREVIEW - NOT FOR SUBMISSION",
  });

  const outDir = path.resolve(import.meta.dirname, "..", "out");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "room-gf-03-4-09.pdf");
  await writeFile(outPath, pdf);

  console.log(`Wrote ${outPath}  (${(pdf.length / 1024).toFixed(0)} KB)`);
  console.log(`Room ${ROOM_ID} — ${AREA_M2} m² — ceiling ${CEILING}`);
  for (const level of levels) {
    console.log(
      `  ${level.name}: ${level.wallCount} walls, ${level.openingCount} openings, ${level.itemCount} items`,
    );
  }
  for (const sheet of sheets) {
    console.log(`  ${sheet.code}  ${sheet.title.padEnd(22)} 1:${sheet.scale}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
