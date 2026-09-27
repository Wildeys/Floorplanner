/**
 * Emits a sample architectural set from a synthetic model shaped like the
 * ARTEFACT "Everglow" reference building, so the output can be put beside
 * `samplephotos/` and judged without drawing anything first.
 *
 *   npm run emit:sample
 *
 * Print at 100% / actual size to check the plan measures 1:100.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { derivePlanLevels, type SceneNodes } from "../src/lib/sheets/derive-plan.ts";
import { MALDIVES_PROFILE, type ProjectMetadata } from "../src/lib/sheets/jurisdiction.ts";
import { renderSheetSet } from "../src/lib/sheets/sheet-set.ts";

/** Overall envelope from sheet A.01: 19.092 m × 8.487 m, 150 mm walls. */
const WIDTH = 19.092;
const DEPTH = 8.487;
const WALL = 0.15;

/** Grid bay widths A→F, in millimetres, as dimensioned on the reference sheet. */
const BAYS_MM = [3823, 3808, 3808, 3808, 3845];

const PROJECT: ProjectMetadata = {
  projectName: "Everglow",
  client: "Azim",
  date: "23-09-2026",
  projectNo: "-",
  firmName: "ARTEFACT",
  firmDiscipline: "ARCHITECTS, PLANNERS & ENGINEERS.",
  contactNo: "7795009",
  email: "ameel.artefact@gmail.com",
  // Personnel fields intentionally omitted: a generated set carries no name
  // until a human signs it at QA release (FR-520, FR-Q3).
};

type Node = Record<string, unknown>;

function perimeter(levelId: string, prefix: string): Node[] {
  const corners: [number, number][] = [
    [0, 0],
    [WIDTH, 0],
    [WIDTH, DEPTH],
    [0, DEPTH],
  ];
  return corners.map((start, i) => ({
    id: `${prefix}_p${i}`,
    type: "wall",
    parentId: levelId,
    start,
    end: corners[(i + 1) % corners.length]!,
    thickness: WALL,
  }));
}

/** Cross walls on the structural grid, forming the guest-room bays. */
function partitions(levelId: string, prefix: string): Node[] {
  const nodes: Node[] = [];
  let x = 0;
  BAYS_MM.slice(0, -1).forEach((bay, i) => {
    x += bay / 1000;
    nodes.push({
      id: `${prefix}_x${i}`,
      type: "wall",
      parentId: levelId,
      start: [x, DEPTH * 0.45],
      end: [x, DEPTH],
      thickness: 0.1,
    });
  });
  // Corridor wall running the length of the plan.
  nodes.push({
    id: `${prefix}_corridor`,
    type: "wall",
    parentId: levelId,
    start: [0, DEPTH * 0.45],
    end: [WIDTH, DEPTH * 0.45],
    thickness: 0.1,
  });
  return nodes;
}

function rooms(levelId: string, prefix: string, label: string): Node[] {
  const nodes: Node[] = [];
  let x = 0;
  BAYS_MM.forEach((bay, i) => {
    const w = bay / 1000;
    nodes.push({
      id: `${prefix}_z${i}`,
      type: "zone",
      parentId: levelId,
      name: `${label} ${i + 1}`,
      polygon: [
        [x + WALL, DEPTH * 0.45 + 0.05],
        [x + w - 0.05, DEPTH * 0.45 + 0.05],
        [x + w - 0.05, DEPTH - WALL],
        [x + WALL, DEPTH - WALL],
      ],
    });
    x += w;
  });
  return nodes;
}

/**
 * A door into each guest room off the corridor, and a window on the rear wall
 * of each bay — the arrangement the reference set's A.01 shows.
 *
 * `position[0]` is metres from the host wall's start, which is why the corridor
 * door offsets are measured along that wall rather than in world space.
 */
function openings(levelId: string, prefix: string): Node[] {
  const nodes: Node[] = [];
  let x = 0;
  BAYS_MM.forEach((bay, i) => {
    const w = bay / 1000;
    // Door off the corridor wall, centred in the bay.
    nodes.push({
      id: `${prefix}_d${i}`,
      type: "door",
      parentId: levelId,
      wallId: `${prefix}_corridor`,
      width: 0.8,
      position: [x + w / 2, 0, 0],
      mark: "D03",
      hingesSide: i % 2 === 0 ? "left" : "right",
    });
    // Window on the rear perimeter wall. That wall runs from [W,D] to [0,D],
    // so its local distance counts back from the far end.
    nodes.push({
      id: `${prefix}_w${i}`,
      type: "window",
      parentId: levelId,
      wallId: `${prefix}_p2`,
      width: 1.5,
      position: [WIDTH - (x + w / 2), 0, 0],
      mark: "W01",
    });
    x += w;
  });
  return nodes;
}

/** A bed and a side table per bay, so the plan carries real furniture. */
function furniture(levelId: string, prefix: string): Node[] {
  const nodes: Node[] = [];
  let x = 0;
  BAYS_MM.forEach((bay, i) => {
    const w = bay / 1000;
    const centreX = x + w / 2;
    nodes.push({
      id: `${prefix}_bed${i}`,
      type: "item",
      parentId: levelId,
      name: "Double bed",
      position: [centreX, 0, DEPTH - 1.4],
      dimensions: [1.6, 0.5, 2.0],
      rotation: [0, 0, 0],
    });
    nodes.push({
      id: `${prefix}_tbl${i}`,
      type: "item",
      parentId: levelId,
      name: "Side table",
      position: [centreX - 1.1, 0, DEPTH - 0.6],
      dimensions: [0.45, 0.5, 0.45],
      rotation: [0, 0, 0],
    });
    x += w;
  });
  return nodes;
}

function buildScene(): SceneNodes {
  const storeys = [
    { id: "level_0", name: "Ground", elevation: 0, label: "Room" },
    { id: "level_1", name: "First", elevation: 3, label: "Room" },
    { id: "level_2", name: "Terrace", elevation: 6, label: "Room" },
  ];

  const nodes: Record<string, Node> = {};
  for (const [index, storey] of storeys.entries()) {
    nodes[storey.id] = {
      id: storey.id,
      type: "level",
      name: storey.name,
      baseElevation: storey.elevation,
      height: 3,
    };
    const prefix = `L${index}`;
    for (const node of [
      ...perimeter(storey.id, prefix),
      ...partitions(storey.id, prefix),
      ...rooms(storey.id, prefix, storey.label),
      ...openings(storey.id, prefix),
      ...furniture(storey.id, prefix),
    ]) {
      nodes[node.id as string] = node;
    }
  }
  return nodes as SceneNodes;
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
  const outPath = path.join(outDir, "everglow-architectural-set.pdf");
  await writeFile(outPath, pdf);

  console.log(`Wrote ${outPath}  (${(pdf.length / 1024).toFixed(0)} KB)`);
  console.log(`Profile: ${MALDIVES_PROFILE.name} — ${MALDIVES_PROFILE.page} ${MALDIVES_PROFILE.orientation}`);
  console.log("");
  for (const sheet of sheets) {
    console.log(
      `  ${sheet.code}  ${sheet.title.padEnd(24)} 1:${sheet.scale}` +
        `  ${sheet.planWidthMm.toFixed(1)} x ${sheet.planHeightMm.toFixed(1)} mm on paper` +
        (sheet.atDefaultScale ? "" : "  (reduced to fit)"),
    );
  }
  console.log("");
  console.log("Compare against samplephotos/. Print at 100% to verify 1:100.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
