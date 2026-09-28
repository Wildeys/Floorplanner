import { test } from "node:test";
import assert from "node:assert/strict";

import { derivePlanLevels, type SceneNodes } from "./derive-plan.ts";
import {
  formatFeetInches,
  MALDIVES_PROFILE,
  type ProjectMetadata,
  sheetCodeAt,
} from "./jurisdiction.ts";
import { drawingViewport, floorPlanTitle, renderSheetSet, resolveSheetScale } from "./sheet-set.ts";
import { mmToPoints, pageSizePoints, pointsToMm } from "./scale.ts";

const PROJECT: ProjectMetadata = {
  projectName: "Everglow",
  client: "Azim",
  date: "23-09-2026",
  firmName: "ARTEFACT",
  firmDiscipline: "ARCHITECTS, PLANNERS & ENGINEERS.",
  contactNo: "7795009",
  email: "ameel.artefact@gmail.com",
};

function roomWalls(w: number, h: number, parentId = "level_0", prefix = "w") {
  const corners: [number, number][] = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];
  return corners.map((start, i) => ({
    id: `${prefix}_${i}`,
    type: "wall" as const,
    parentId,
    start,
    end: corners[(i + 1) % corners.length]!,
    thickness: 0.15,
  }));
}

function sceneWith(levels: { id: string; name: string; elevation: number }[]): SceneNodes {
  const nodes: Record<string, unknown> = {};
  for (const [index, level] of levels.entries()) {
    nodes[level.id] = {
      id: level.id,
      type: "level",
      name: level.name,
      baseElevation: level.elevation,
    };
    for (const wall of roomWalls(19.092, 8.487, level.id, `w${index}`)) {
      nodes[wall.id] = wall;
    }
  }
  return nodes as SceneNodes;
}

/** Every path coordinate in the PDF, page by page. */
function pagePoints(pdf: Buffer): [number, number][] {
  const text = pdf.toString("latin1");
  const points: [number, number][] = [];
  const re = /(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+([ml])\b/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    points.push([Number(match[1]), Number(match[2])]);
  }
  return points;
}

function countPages(pdf: Buffer): number {
  return (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}

/**
 * The visible text of the PDF.
 *
 * PDFKit writes strings hex-encoded inside the `TJ` array operator
 * (`[<48454c4c4f> 0] TJ`), so searching the raw bytes for ASCII finds nothing
 * even when the text is present. Matching only inside `[...] TJ` keeps object
 * ids and other hex blobs out of the result.
 */
function extractText(pdf: Buffer): string {
  const raw = pdf.toString("latin1");
  const lines: string[] = [];
  const operator = /\[\s*((?:<[0-9A-Fa-f]*>\s*-?[\d.]*\s*)+)\]\s*TJ/g;
  let match: RegExpExecArray | null;
  while ((match = operator.exec(raw)) !== null) {
    let line = "";
    for (const chunk of match[1]!.matchAll(/<([0-9A-Fa-f]*)>/g)) {
      const hex = chunk[1]!;
      if (hex.length % 2 !== 0) continue;
      for (let i = 0; i < hex.length; i += 2) {
        line += String.fromCharCode(Number.parseInt(hex.slice(i, i + 2), 16));
      }
    }
    lines.push(line);
  }
  return lines.join("\n");
}

test("feet-and-inches formatting matches the reference sheets", () => {
  assert.equal(formatFeetInches(19292), `[63'-4"]`);
  assert.equal(formatFeetInches(9624), `[31'-7"]`);
  assert.equal(formatFeetInches(3852), `[12'-8"]`);
  // A rounded 12 inches must carry into the feet, never print as 4'-12".
  assert.equal(formatFeetInches(1523), `[5'-0"]`);
});

test("sheet codes increment per level and keep their padding", () => {
  const def = { code: "A.01", title: "FLOOR PLAN", scale: 100, repeat: "per-level" } as const;
  assert.equal(sheetCodeAt(def, 0), "A.01");
  assert.equal(sheetCodeAt(def, 1), "A.02");
  assert.equal(sheetCodeAt(def, 9), "A.10");
  // A 'single' sheet keeps its code no matter how many levels exist.
  const single = { ...def, repeat: "single" } as const;
  assert.equal(sheetCodeAt(single, 3), "A.01");
});

test("the drawing viewport clears both the title block and the stamp reserve", () => {
  const pageSize = pageSizePoints(MALDIVES_PROFILE.page, MALDIVES_PROFILE.orientation);
  const page = { widthPt: pageSize[0], heightPt: pageSize[1] };
  const viewport = drawingViewport(MALDIVES_PROFILE, page);

  const reserveTopPt =
    page.heightPt -
    mmToPoints(MALDIVES_PROFILE.stampReserve.offsetMm) -
    mmToPoints(MALDIVES_PROFILE.stampReserve.sizeMm);
  assert.ok(
    viewport.y + viewport.height <= reserveTopPt,
    "viewport must stop above the stamp reserve",
  );

  const titleBlockLeft =
    page.widthPt - mmToPoints(MALDIVES_PROFILE.marginMm) - mmToPoints(MALDIVES_PROFILE.titleBlockWidthMm);
  assert.ok(viewport.x + viewport.width <= titleBlockLeft, "viewport must stop left of the title block");
});

test("scale steps coarser only when the plan cannot fit", () => {
  const viewport = { x: 0, y: 0, width: mmToPoints(280), height: mmToPoints(180) };

  // 19 m fits at 1:100 (191 mm).
  const fits = resolveSheetScale(19.092, 8.487, viewport, 100);
  assert.equal(fits.scale, 100);
  assert.equal(fits.atRequested, true);

  // 40 m does not (400 mm), so it must step coarser rather than be squashed.
  const stepped = resolveSheetScale(40, 20, viewport, 100);
  assert.equal(stepped.atRequested, false);
  assert.ok(stepped.scale > 100, `expected a coarser scale, got 1:${stepped.scale}`);
});

test("a set renders one page per level at true scale", async () => {
  const nodes = sceneWith([
    { id: "level_0", name: "Ground", elevation: 0 },
    { id: "level_1", name: "First", elevation: 3 },
    { id: "level_2", name: "Terrace", elevation: 6 },
  ]);
  const levels = derivePlanLevels(nodes);
  assert.equal(levels.length, 3);

  const { pdf, sheets } = await renderSheetSet({
    profile: MALDIVES_PROFILE,
    project: PROJECT,
    levels,
    watermark: "PREVIEW",
  });

  assert.equal(sheets.length, 3);
  assert.equal(countPages(pdf), 3, "one page per storey");

  assert.deepEqual(
    sheets.map((s) => s.code),
    ["A.01", "A.02", "A.03"],
  );
  assert.equal(sheets[0]!.title, "GROUND FLOOR PLAN");

  for (const sheet of sheets) {
    assert.equal(sheet.scale, 100);
    assert.equal(sheet.atDefaultScale, true);
    // The placed width is the building (19.092 m + 0.15 m of wall = 192.42 mm
    // at 1:100) plus the annotation's paper margin, which is a constant 28.7 mm
    // whatever the scale.
    assert.ok(
      Math.abs(sheet.planWidthMm - 221.1) < 0.5,
      `expected ~221.1 mm, got ${sheet.planWidthMm}`,
    );
  }
});

test("no ink falls inside the council stamp reserve", async () => {
  const levels = derivePlanLevels(sceneWith([{ id: "level_0", name: "Ground", elevation: 0 }]));
  const { pdf } = await renderSheetSet({
    profile: MALDIVES_PROFILE,
    project: PROJECT,
    levels,
    watermark: "PREVIEW",
  });

  const pageSize = pageSizePoints(MALDIVES_PROFILE.page, MALDIVES_PROFILE.orientation);
  const offset = mmToPoints(MALDIVES_PROFILE.stampReserve.offsetMm);
  const size = mmToPoints(MALDIVES_PROFILE.stampReserve.sizeMm);
  const left = offset;
  const right = offset + size;
  const bottom = pageSize[1] - offset;
  const top = pageSize[1] - offset - size;

  // The reserve's own dashed outline sits exactly on the boundary, so only
  // points strictly inside it count as an intrusion.
  const inset = 0.5;
  const intruders = pagePoints(pdf).filter(
    ([x, y]) =>
      x > left + inset && x < right - inset && y > top + inset && y < bottom - inset,
  );

  assert.equal(
    intruders.length,
    0,
    `${intruders.length} path point(s) intrude on the stamp reserve, e.g. ${JSON.stringify(intruders[0])}`,
  );
});

test("personnel fields stay blank in a generated set", async () => {
  const levels = derivePlanLevels(sceneWith([{ id: "level_0", name: "Ground", elevation: 0 }]));
  const { pdf } = await renderSheetSet({
    profile: MALDIVES_PROFILE,
    project: PROJECT,
    levels,
    watermark: "PREVIEW",
  });
  const text = extractText(pdf);

  // Labels are printed...
  assert.ok(text.includes("ARCHITECT:"), "architect label should be printed");
  assert.ok(text.includes("STRUCTURAL CHECKER:"), "structural checker label should be printed");
  // ...but no name is ever auto-filled (FR-520, FR-Q3).
  for (const name of ["Ulooma", "Ameel", "Naseeh", "Zuhal"]) {
    assert.ok(!text.includes(name), `a generated set must not pre-fill "${name}"`);
  }
});

test("project metadata reaches the title block", async () => {
  const levels = derivePlanLevels(sceneWith([{ id: "level_0", name: "Ground", elevation: 0 }]));
  const { pdf } = await renderSheetSet({
    profile: MALDIVES_PROFILE,
    project: PROJECT,
    levels,
    watermark: null,
  });
  const text = extractText(pdf);

  for (const expected of ["Everglow", "Azim", "23-09-2026", "ARTEFACT", "1:100", "A.01"]) {
    assert.ok(text.includes(expected), `title block should carry "${expected}"`);
  }
});

test("a watermark is present when asked for and absent when not", async () => {
  const levels = derivePlanLevels(sceneWith([{ id: "level_0", name: "Ground", elevation: 0 }]));

  const preview = await renderSheetSet({
    profile: MALDIVES_PROFILE,
    project: PROJECT,
    levels,
    watermark: "PREVIEW - NOT FOR SUBMISSION",
  });
  assert.ok(extractText(preview.pdf).includes("NOT FOR SUBMISSION"));

  const released = await renderSheetSet({
    profile: MALDIVES_PROFILE,
    project: PROJECT,
    levels,
    watermark: null,
  });
  assert.ok(!extractText(released.pdf).includes("NOT FOR SUBMISSION"));
});

test("an empty model is refused rather than emitting a blank set", async () => {
  await assert.rejects(
    () =>
      renderSheetSet({
        profile: MALDIVES_PROFILE,
        project: PROJECT,
        levels: [],
        watermark: null,
      }),
    /no levels with geometry/,
  );
});

test("the emitted page is physically A3 landscape", async () => {
  const levels = derivePlanLevels(sceneWith([{ id: "level_0", name: "Ground", elevation: 0 }]));
  const { pdf } = await renderSheetSet({
    profile: MALDIVES_PROFILE,
    project: PROJECT,
    levels,
    watermark: null,
  });

  const match = /\/MediaBox\s*\[\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*\]/.exec(
    pdf.toString("latin1"),
  );
  assert.ok(match);
  assert.ok(Math.abs(pointsToMm(Number(match[3]) - Number(match[1])) - 420) < 0.5);
  assert.ok(Math.abs(pointsToMm(Number(match[4]) - Number(match[2])) - 297) < 0.5);
});

test("a small building is enlarged to the next standard plan scale", () => {
  const viewport = { x: 0, y: 0, width: mmToPoints(280), height: mmToPoints(180) };

  // 5.5 m at 1:100 is 55 mm across a 280 mm viewport — the sheet reads empty.
  // A draughtsman draws that at 1:50.
  const small = resolveSheetScale(5.5, 3.5, viewport, 100, 50);
  assert.equal(small.scale, 50, "stepped finer to fill the sheet");
  assert.equal(small.atRequested, false);

  // But never past the profile's finest plan scale: 1:20 is a detail, not a plan.
  const tiny = resolveSheetScale(1.2, 1.0, viewport, 100, 50);
  assert.equal(tiny.scale, 50, "clamped at the finest plan scale");
});

test("a building that suits 1:100 is left at 1:100", () => {
  const viewport = { x: 0, y: 0, width: mmToPoints(280), height: mmToPoints(180) };
  const reference = resolveSheetScale(19.092, 8.487, viewport, 100, 50);
  assert.equal(reference.scale, 100, "1:50 would not fit, so the convention holds");
  assert.equal(reference.atRequested, true);
});

test("an oversized building still steps coarser, not finer", () => {
  const viewport = { x: 0, y: 0, width: mmToPoints(280), height: mmToPoints(180) };
  const huge = resolveSheetScale(40, 20, viewport, 100, 50);
  assert.ok(huge.scale > 100, `expected coarser than 1:100, got 1:${huge.scale}`);
});

test("floor plan titles never double a word", () => {
  assert.equal(floorPlanTitle("Ground"), "GROUND FLOOR PLAN");
  // A level literally named "Level" must not print "LEVEL FLOOR PLAN".
  assert.equal(floorPlanTitle("Level"), "FLOOR PLAN");
  assert.equal(floorPlanTitle(""), "FLOOR PLAN");
  // Nor should an already-qualified name gain a second "FLOOR".
  assert.equal(floorPlanTitle("Ground Floor"), "GROUND FLOOR PLAN");
  assert.equal(floorPlanTitle("Roof Plan"), "ROOF PLAN");
});
