/**
 * furniture-library.ts
 *
 * Parametric furniture for plan sheets and lightweight 3D, sized for a
 * Maldivian guesthouse (rooms, en-suites, balconies) and small office fit-outs.
 *
 * Pure module: no React, no DOM, no Three, no pdfkit. It belongs next to
 * src/lib/sheets and runs unchanged in a Node export worker.
 *
 * Why this shape:
 *  - Nothing is downloaded. Each item is a few hundred bytes of code; a saved
 *    scene stores only { type, w, d, h } plus position, so it costs almost
 *    nothing in localStorage or the database.
 *  - The plan symbol is drawn for paper (pillows, cistern, hangers), the way
 *    architects draw it. It is never a projection of a 3D mesh.
 *  - One authority: the editor's 2D view, the catalogue thumbnail and the PDF
 *    sheet all read the same `plan()` output, the same way derive-plan reuses
 *    calculateLevelMiters.
 *
 * Coordinates are item-local millimetres. The origin is the BACK-LEFT corner of
 * the footprint: x runs along the width (0..w), y runs from the back edge
 * (y = 0, the side that goes against the wall) to the front edge (y = d).
 * z (3D only) runs up from the floor. Every plan primitive stays inside
 * [0, w] x [0, d]; `checkFootprint` asserts that.
 *
 * Text sizes are PAPER millimetres and never scale, like the pen table.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Maps onto pens.ts: 'outline' = furniture outline pen, 'detail' = finest pen. */
export type Pen = 'outline' | 'detail';

export type PlanPrimitive =
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; pen: Pen; dashed?: boolean }
  | { kind: 'rect'; x: number; y: number; w: number; h: number; r: number; pen: Pen; dashed?: boolean }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; pen: Pen; dashed?: boolean }
  /** An L-shaped counter or desk is one outline, not two overlapping rects. */
  | { kind: 'poly'; points: readonly (readonly [number, number])[]; closed: boolean; pen: Pen; dashed?: boolean }
  | { kind: 'text'; x: number; y: number; text: string; sizeMm: number; angleDeg: number };

export type Solid =
  | { kind: 'box'; x: number; y: number; z: number; w: number; d: number; h: number }
  | { kind: 'cylinder'; cx: number; cy: number; z: number; r: number; h: number };

export interface Size {
  w: number;
  d: number;
  h: number;
}

export type Category = 'bedroom' | 'bathroom' | 'living' | 'dining' | 'office' | 'kitchen' | 'it';

export interface FurnitureType {
  id: string;
  label: string;
  category: Category;
  defaults: Size;
  min: Size;
  max: Size;
  /** Width and depth stay equal (round tables). */
  keepSquare?: boolean;
  plan: (s: Size) => PlanPrimitive[];
  solids: (s: Size) => Solid[];
}

// ---------------------------------------------------------------------------
// Small builders
// ---------------------------------------------------------------------------

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

function rect(x: number, y: number, w: number, h: number, pen: Pen = 'outline', r = 0, dashed = false): PlanPrimitive {
  return dashed ? { kind: 'rect', x, y, w, h, r, pen, dashed } : { kind: 'rect', x, y, w, h, r, pen };
}
function line(x1: number, y1: number, x2: number, y2: number, pen: Pen = 'detail'): PlanPrimitive {
  return { kind: 'line', x1, y1, x2, y2, pen };
}
function ellipse(cx: number, cy: number, rx: number, ry: number, pen: Pen = 'outline'): PlanPrimitive {
  return { kind: 'ellipse', cx, cy, rx, ry, pen };
}
function poly(points: readonly (readonly [number, number])[], pen: Pen = 'outline', closed = true, dashed = false): PlanPrimitive {
  return dashed ? { kind: 'poly', points, closed, pen, dashed } : { kind: 'poly', points, closed, pen };
}
function text(x: number, y: number, value: string, sizeMm = 1.6, angleDeg = 0): PlanPrimitive {
  return { kind: 'text', x, y, text: value, sizeMm, angleDeg };
}
function box(x: number, y: number, z: number, w: number, d: number, h: number): Solid {
  return { kind: 'box', x, y, z, w, d, h };
}
function cyl(cx: number, cy: number, z: number, r: number, h: number): Solid {
  return { kind: 'cylinder', cx, cy, z, r, h };
}

// ---------------------------------------------------------------------------
// Symbols
// ---------------------------------------------------------------------------

function bed(pillows: 1 | 2) {
  const HEADBOARD = 60;
  return {
    plan: ({ w, d }: Size): PlanPrimitive[] => {
      const fold = d * 0.34; // turned-down duvet edge
      const ph = clamp(d * 0.15, 250, 330);
      const py = HEADBOARD + 50;
      const prims: PlanPrimitive[] = [
        rect(0, 0, w, d, 'outline'),
        line(0, HEADBOARD, w, HEADBOARD, 'outline'),
        line(0, fold, w, fold, 'detail'),
        line(w * 0.55, fold, w, fold + w * 0.45, 'detail'), // folded corner
      ];
      if (pillows === 2) {
        const pw = clamp((w - 180) / 2, 300, 700);
        prims.push(rect(w / 2 - 30 - pw, py, pw, ph, 'detail', 60));
        prims.push(rect(w / 2 + 30, py, pw, ph, 'detail', 60));
      } else {
        const pw = clamp(w - 200, 300, 700);
        prims.push(rect((w - pw) / 2, py, pw, ph, 'detail', 60));
      }
      return prims;
    },
    solids: ({ w, d, h }: Size): Solid[] => [
      box(0, HEADBOARD, 0, w, d - HEADBOARD, h),
      box(0, 0, 0, w, HEADBOARD, Math.max(h + 450, 1000)),
    ],
  };
}

const doubleBed = bed(2);
const singleBed = bed(1);

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export const FURNITURE: readonly FurnitureType[] = [
  // ---- Bedroom -----------------------------------------------------------
  {
    id: 'bed-double',
    label: 'Double bed',
    category: 'bedroom',
    defaults: { w: 1600, d: 2000, h: 550 },
    min: { w: 1200, d: 1900, h: 300 },
    max: { w: 2000, d: 2200, h: 700 },
    ...doubleBed,
  },
  {
    id: 'bed-single',
    label: 'Single bed',
    category: 'bedroom',
    defaults: { w: 900, d: 2000, h: 550 },
    min: { w: 800, d: 1900, h: 300 },
    max: { w: 1200, d: 2100, h: 700 },
    ...singleBed,
  },
  {
    id: 'bedside-table',
    label: 'Bedside table',
    category: 'bedroom',
    defaults: { w: 450, d: 400, h: 550 },
    min: { w: 350, d: 300, h: 400 },
    max: { w: 600, d: 500, h: 700 },
    plan: ({ w, d }) => {
      const r = Math.min(w, d) * 0.3;
      return [rect(0, 0, w, d, 'outline'), ellipse(w / 2, d / 2, r, r, 'detail'), ellipse(w / 2, d / 2, r * 0.35, r * 0.35, 'detail')];
    },
    solids: ({ w, d, h }) => [box(0, 0, 0, w, d, h)],
  },
  {
    id: 'wardrobe',
    label: 'Wardrobe',
    category: 'bedroom',
    defaults: { w: 1200, d: 600, h: 2100 },
    min: { w: 600, d: 500, h: 1800 },
    max: { w: 3000, d: 700, h: 2400 },
    plan: ({ w, d }) => {
      const prims: PlanPrimitive[] = [rect(0, 0, w, d, 'outline'), line(40, d / 2, w - 40, d / 2, 'detail')];
      // Hangers: short slanted strokes across the rail.
      const count = Math.max(2, Math.floor((w - 160) / 220));
      const step = (w - 160) / (count - 1);
      for (let i = 0; i < count; i++) {
        const x = 80 + i * step;
        prims.push(line(x - 30, d * 0.15, x + 30, d * 0.85, 'detail'));
      }
      return prims;
    },
    solids: ({ w, d, h }) => [box(0, 0, 0, w, d, h)],
  },
  {
    id: 'luggage-rack',
    label: 'Luggage rack',
    category: 'bedroom',
    defaults: { w: 900, d: 500, h: 450 },
    min: { w: 600, d: 400, h: 400 },
    max: { w: 1200, d: 600, h: 600 },
    plan: ({ w, d }) => [
      rect(0, 0, w, d, 'outline'),
      line(0, d * 0.2, w, d * 0.2, 'detail'),
      line(0, d * 0.8, w, d * 0.8, 'detail'),
      text(w / 2, d / 2, 'LUGGAGE', 1.5),
    ],
    solids: ({ w, d, h }) => [box(0, 0, 0, w, d, h)],
  },
  {
    id: 'tv-unit',
    label: 'TV unit',
    category: 'bedroom',
    defaults: { w: 1500, d: 450, h: 600 },
    min: { w: 900, d: 350, h: 400 },
    max: { w: 2400, d: 600, h: 900 },
    plan: ({ w, d }) => {
      const tv = clamp(w * 0.6, 600, 1600);
      return [rect(0, 0, w, d, 'outline'), rect((w - tv) / 2, 30, tv, 50, 'outline'), text(w / 2, d * 0.62, 'TV', 1.8)];
    },
    solids: ({ w, d, h }) => {
      const tv = clamp(w * 0.6, 600, 1600);
      return [box(0, 0, 0, w, d, h), box((w - tv) / 2, 30, h + 100, tv, 50, tv * 0.56)];
    },
  },

  // ---- Bathroom ----------------------------------------------------------
  {
    id: 'wc',
    label: 'WC',
    category: 'bathroom',
    defaults: { w: 400, d: 700, h: 800 },
    min: { w: 340, d: 600, h: 700 },
    max: { w: 450, d: 800, h: 900 },
    plan: ({ w, d }) => {
      const cistern = 180;
      const ry = (d - cistern) / 2;
      const cy = cistern + ry;
      return [
        rect(0, 0, w, cistern, 'outline', 20),
        ellipse(w / 2, cy, w * 0.45, ry, 'outline'),
        ellipse(w / 2, cy + ry * 0.08, w * 0.28, ry * 0.62, 'detail'),
      ];
    },
    solids: ({ w, d, h }) => [box(0, 0, 0, w, 180, h), cyl(w / 2, 180 + (d - 180) / 2, 0, w * 0.45, 400)],
  },
  {
    id: 'basin-vanity',
    label: 'Basin + vanity',
    category: 'bathroom',
    defaults: { w: 600, d: 450, h: 850 },
    min: { w: 400, d: 350, h: 750 },
    max: { w: 1500, d: 600, h: 950 },
    plan: ({ w, d }) => [
      rect(0, 0, w, d, 'outline'),
      ellipse(w / 2, d * 0.56, Math.min(w * 0.36, 230), d * 0.3, 'detail'),
      ellipse(w / 2, d * 0.14, 22, 22, 'detail'),
    ],
    solids: ({ w, d, h }) => [box(0, 0, 0, w, d, h)],
  },
  {
    id: 'shower-tray',
    label: 'Shower tray',
    category: 'bathroom',
    defaults: { w: 900, d: 900, h: 60 },
    min: { w: 700, d: 700, h: 30 },
    max: { w: 1500, d: 1200, h: 100 },
    plan: ({ w, d }) => [
      rect(0, 0, w, d, 'outline'),
      rect(40, 40, w - 80, d - 80, 'detail'),
      line(40, 40, w - 40, d - 40, 'detail'),
      line(w - 40, 40, 40, d - 40, 'detail'),
      ellipse(w / 2, d / 2, 45, 45, 'detail'),
    ],
    solids: ({ w, d, h }) => [box(0, 0, 0, w, d, h)],
  },

  // ---- Living / balcony --------------------------------------------------
  {
    id: 'armchair',
    label: 'Armchair',
    category: 'living',
    defaults: { w: 750, d: 750, h: 750 },
    min: { w: 600, d: 600, h: 650 },
    max: { w: 1000, d: 1000, h: 1000 },
    plan: ({ w, d }) => {
      const arm = clamp(w * 0.17, 90, 170);
      const back = clamp(d * 0.22, 120, 220);
      return [rect(0, 0, w, d, 'outline', 120), rect(arm, back, w - 2 * arm, d - back - 40, 'detail', 60)];
    },
    solids: ({ w, d, h }) => {
      const arm = clamp(w * 0.17, 90, 170);
      const back = clamp(d * 0.22, 120, 220);
      return [box(0, back, 0, w, d - back, 420), box(0, 0, 0, w, back, h), box(0, back, 420, arm, d - back, 200), box(w - arm, back, 420, arm, d - back, 200)];
    },
  },
  {
    id: 'sofa',
    label: 'Sofa',
    category: 'living',
    defaults: { w: 2000, d: 900, h: 800 },
    min: { w: 1400, d: 800, h: 700 },
    max: { w: 3200, d: 1100, h: 950 },
    plan: ({ w, d }) => {
      const arm = clamp(w * 0.1, 150, 250);
      const back = clamp(d * 0.25, 180, 260);
      const seatW = w - 2 * arm;
      const n = Math.max(2, Math.round(seatW / 700));
      const prims: PlanPrimitive[] = [rect(0, 0, w, d, 'outline', 100), rect(arm, back, seatW, d - back - 30, 'detail', 40)];
      for (let i = 1; i < n; i++) {
        const x = arm + (i * seatW) / n;
        prims.push(line(x, back, x, d - 30, 'detail'));
      }
      return prims;
    },
    solids: ({ w, d, h }) => {
      const arm = clamp(w * 0.1, 150, 250);
      const back = clamp(d * 0.25, 180, 260);
      return [box(0, back, 0, w, d - back, 430), box(0, 0, 0, w, back, h), box(0, back, 430, arm, d - back, 200), box(w - arm, back, 430, arm, d - back, 200)];
    },
  },
  {
    id: 'table-round',
    label: 'Round table',
    category: 'living',
    defaults: { w: 600, d: 600, h: 450 },
    min: { w: 400, d: 400, h: 400 },
    max: { w: 1200, d: 1200, h: 750 },
    keepSquare: true,
    plan: ({ w }) => [ellipse(w / 2, w / 2, w / 2, w / 2, 'outline')],
    solids: ({ w, h }) => [cyl(w / 2, w / 2, h - 30, w / 2, 30), cyl(w / 2, w / 2, 0, 40, h - 30)],
  },

  // ---- Dining ------------------------------------------------------------
  {
    id: 'table-rect',
    label: 'Table',
    category: 'dining',
    defaults: { w: 1200, d: 800, h: 750 },
    min: { w: 600, d: 600, h: 400 },
    max: { w: 3000, d: 1200, h: 800 },
    plan: ({ w, d }) => [rect(0, 0, w, d, 'outline')],
    solids: ({ w, d, h }) => {
      const leg = 60;
      return [
        box(0, 0, h - 30, w, d, 30),
        box(30, 30, 0, leg, leg, h - 30),
        box(w - 30 - leg, 30, 0, leg, leg, h - 30),
        box(30, d - 30 - leg, 0, leg, leg, h - 30),
        box(w - 30 - leg, d - 30 - leg, 0, leg, leg, h - 30),
      ];
    },
  },
  {
    id: 'chair',
    label: 'Chair',
    category: 'dining',
    defaults: { w: 450, d: 500, h: 850 },
    min: { w: 400, d: 400, h: 750 },
    max: { w: 600, d: 600, h: 1000 },
    plan: ({ w, d }) => [rect(0, 0, w, 70, 'outline', 20), rect(25, 70, w - 50, d - 70, 'outline', 40)],
    solids: ({ w, d, h }) => [box(25, 70, 420, w - 50, d - 70, 40), box(0, 0, 0, w, 70, h)],
  },

  // ---- Office ------------------------------------------------------------
  {
    id: 'desk',
    label: 'Desk',
    category: 'office',
    defaults: { w: 1400, d: 700, h: 750 },
    min: { w: 900, d: 500, h: 700 },
    max: { w: 2000, d: 900, h: 800 },
    plan: ({ w, d }) => {
      const prims: PlanPrimitive[] = [rect(0, 0, w, d, 'outline')];
      // Drawer pedestal sits under the top, so it is hidden: dashed.
      if (w >= 1100) prims.push(rect(w - 420, 20, 400, d - 40, 'detail', 0, true));
      return prims;
    },
    solids: ({ w, d, h }) => {
      const s: Solid[] = [box(0, 0, h - 30, w, d, 30), box(20, 20, 0, 40, d - 40, h - 30)];
      if (w >= 1100) s.push(box(w - 420, 20, 0, 400, d - 40, h - 30));
      else s.push(box(w - 60, 20, 0, 40, d - 40, h - 30));
      return s;
    },
  },
  {
    id: 'office-chair',
    label: 'Office chair',
    category: 'office',
    defaults: { w: 600, d: 600, h: 1000 },
    // Task chairs in a dense fit-out go down to 450 square (GF-03.4.09).
    min: { w: 420, d: 420, h: 900 },
    max: { w: 750, d: 750, h: 1200 },
    plan: ({ w, d }) => [
      rect(w * 0.1, 0, w * 0.8, d * 0.18, 'outline', 50),
      rect(w * 0.1, d * 0.2, w * 0.8, d * 0.72, 'outline', 90),
      rect(0, d * 0.3, w * 0.08, d * 0.42, 'detail', 20),
      rect(w * 0.92, d * 0.3, w * 0.08, d * 0.42, 'detail', 20),
    ],
    solids: ({ w, d, h }) => [
      cyl(w / 2, d / 2, 0, Math.min(w, d) * 0.4, 60),
      cyl(w / 2, d / 2, 60, 30, 380),
      box(w * 0.1, d * 0.2, 440, w * 0.8, d * 0.72, 60),
      box(w * 0.1, 0, 500, w * 0.8, d * 0.18, h - 500),
    ],
  },

  // ---- Kitchen / pantry --------------------------------------------------
  {
    id: 'counter-sink',
    label: 'Counter with sink',
    category: 'kitchen',
    defaults: { w: 1800, d: 600, h: 900 },
    min: { w: 900, d: 500, h: 850 },
    max: { w: 4000, d: 700, h: 950 },
    plan: ({ w, d }) => {
      const bw = Math.min(500, w - 200);
      const by = (d - 420) / 2 + 20;
      return [rect(0, 0, w, d, 'outline'), rect((w - bw) / 2, by, bw, 400, 'detail', 50), ellipse(w / 2, Math.max(25, by - 25), 20, 20, 'detail')];
    },
    solids: ({ w, d, h }) => [box(0, 0, 0, w, d, h)],
  },
  {
    id: 'fridge',
    label: 'Fridge',
    category: 'kitchen',
    defaults: { w: 700, d: 700, h: 1800 },
    min: { w: 550, d: 600, h: 850 },
    max: { w: 1000, d: 800, h: 2000 },
    plan: ({ w, d }) => [rect(0, 0, w, d, 'outline'), line(0, d - 60, w, d - 60, 'detail'), text(w / 2, d * 0.45, 'REF', 1.8)],
    solids: ({ w, d, h }) => [box(0, 0, 0, w, d, h)],
  },

  // ---- Office storage and fit-out ----------------------------------------
  {
    id: 'desk-l',
    label: 'L-shaped desk',
    category: 'office',
    defaults: { w: 1600, d: 1600, h: 750 },
    min: { w: 1200, d: 1200, h: 700 },
    max: { w: 2400, d: 2400, h: 800 },
    plan: ({ w, d }) => {
      // The return leg runs down the right-hand side; the inner corner is the
      // knee hole. One closed outline, not two rects, so no line crosses it.
      const legW = clamp(w * 0.42, 500, 800);
      const legD = clamp(d * 0.42, 500, 800);
      return [
        poly([
          [0, 0],
          [w, 0],
          [w, d],
          [w - legW, d],
          [w - legW, legD],
          [0, legD],
        ]),
        line(w - legW, legD, w, legD, 'detail'),
      ];
    },
    solids: ({ w, d, h }) => {
      const legW = clamp(w * 0.42, 500, 800);
      const legD = clamp(d * 0.42, 500, 800);
      return [
        box(0, 0, h - 30, w, legD, 30),
        box(w - legW, legD, h - 30, legW, d - legD, 30),
        box(20, 20, 0, 40, legD - 40, h - 30),
        box(w - 60, 20, 0, 40, legD - 40, h - 30),
        box(w - legW + 20, d - 60, 0, 40, 40, h - 30),
      ];
    },
  },
  {
    id: 'storage-cabinet',
    label: 'Storage cabinet',
    category: 'office',
    defaults: { w: 900, d: 450, h: 1800 },
    min: { w: 400, d: 300, h: 750 },
    max: { w: 2400, d: 600, h: 2400 },
    plan: ({ w, d }) => {
      // No swing arcs: a leaf opening forward leaves the footprint, and the
      // reference sheets draw joinery as an outline with its leaf divisions —
      // door swings belong to the opening derivation, not to furniture.
      const leaves = clamp(Math.round(w / 600), 1, 6);
      const prims: PlanPrimitive[] = [rect(0, 0, w, d, 'outline')];
      for (let i = 1; i < leaves; i += 1) {
        prims.push(line((w * i) / leaves, 0, (w * i) / leaves, d, 'detail'));
      }
      // The shelf line, set back from the door face.
      prims.push(line(0, d * 0.78, w, d * 0.78, 'detail'));
      return prims;
    },
    solids: ({ w, d, h }) => [box(0, 0, 0, w, d, h)],
  },
  {
    id: 'filing-cabinet',
    label: 'Filing cabinet',
    category: 'office',
    defaults: { w: 450, d: 600, h: 720 },
    min: { w: 380, d: 450, h: 400 },
    max: { w: 900, d: 800, h: 1400 },
    plan: ({ w, d, h }) => {
      // One line per drawer front, read off the height: a 720 pedestal is 3.
      const drawers = clamp(Math.round(h / 270), 2, 5);
      const prims: PlanPrimitive[] = [rect(0, 0, w, d, 'outline')];
      for (let i = 1; i < drawers; i += 1) {
        prims.push(line(w * 0.15, (d * i) / drawers, w * 0.85, (d * i) / drawers, 'detail'));
      }
      return prims;
    },
    solids: ({ w, d, h }) => [box(0, 0, 0, w, d, h)],
  },
  {
    id: 'shelving',
    label: 'Shelving unit',
    category: 'office',
    defaults: { w: 900, d: 350, h: 1800 },
    min: { w: 400, d: 250, h: 600 },
    max: { w: 2400, d: 500, h: 2400 },
    plan: ({ w, d }) => {
      // Open shelves: the uprights are what the plan actually cuts.
      const bays = clamp(Math.round(w / 800), 1, 5);
      const prims: PlanPrimitive[] = [rect(0, 0, w, d, 'outline')];
      for (let i = 1; i < bays; i += 1) {
        prims.push(line((w * i) / bays, 0, (w * i) / bays, d, 'detail'));
      }
      prims.push(line(0, d * 0.25, w, d * 0.25, 'detail'));
      return prims;
    },
    solids: ({ w, d, h }) => {
      const s: Solid[] = [box(0, 0, 0, 25, d, h), box(w - 25, 0, 0, 25, d, h)];
      const shelves = clamp(Math.round(h / 350), 2, 7);
      for (let i = 0; i <= shelves; i += 1) {
        s.push(box(25, 0, Math.min((h * i) / shelves, h - 25), Math.max(0, w - 50), d, 25));
      }
      return s;
    },
  },
  {
    id: 'coat-rail',
    label: 'Coat hooks',
    category: 'office',
    defaults: { w: 800, d: 300, h: 1750 },
    min: { w: 300, d: 150, h: 1200 },
    max: { w: 2000, d: 400, h: 2000 },
    plan: ({ w, d }) => {
      // Wall-mounted: a shallow backboard with hooks projecting forward.
      const hooks = clamp(Math.round(w / 200), 2, 10);
      const board = Math.min(60, d * 0.3);
      const prims: PlanPrimitive[] = [
        rect(0, 0, w, board, 'outline'),
        rect(0, 0, w, d, 'detail', 0, true),
      ];
      for (let i = 0; i < hooks; i += 1) {
        const x = (w * (i + 0.5)) / hooks;
        prims.push(line(x, board, x, d * 0.75, 'detail'));
      }
      return prims;
    },
    solids: ({ w, d, h }) => [box(0, 0, h - 200, w, Math.min(60, d * 0.3), 200)],
  },
  {
    id: 'overhead-cabinet',
    label: 'Overhead cabinet',
    category: 'office',
    defaults: { w: 1200, d: 350, h: 700 },
    min: { w: 400, d: 250, h: 400 },
    max: { w: 3000, d: 450, h: 900 },
    plan: ({ w, d }) => {
      // Wall-hung above the cut plane, so the whole symbol is hidden: dashed
      // throughout. This is the A-FURN-OVHD convention in the room spec.
      const prims: PlanPrimitive[] = [rect(0, 0, w, d, 'detail', 0, true)];
      const doors = clamp(Math.round(w / 600), 1, 5);
      for (let i = 1; i < doors; i += 1) {
        prims.push({ kind: 'line', x1: (w * i) / doors, y1: 0, x2: (w * i) / doors, y2: d, pen: 'detail', dashed: true });
      }
      return prims;
    },
    // Hung with its underside at 1400 so it clears a 900 counter.
    solids: ({ w, d, h }) => [box(0, 0, 1400, w, d, h)],
  },
  {
    id: 'counter-l',
    label: 'L-shaped counter',
    category: 'kitchen',
    defaults: { w: 1400, d: 2000, h: 900 },
    min: { w: 700, d: 700, h: 850 },
    max: { w: 4000, d: 4000, h: 950 },
    plan: ({ w, d }) => {
      // Pantry run turning a corner (GF-03.4.09's CTR-01). The leg depth is
      // the standard 600 unless the piece is too small to carry it.
      const legW = clamp(Math.min(w, d) * 0.43, 300, 600);
      return [
        poly([
          [0, 0],
          [w, 0],
          [w, d],
          [w - legW, d],
          [w - legW, legW],
          [0, legW],
        ]),
        ellipse(w - legW / 2, d - legW * 1.2, legW * 0.3, legW * 0.3, 'detail'),
      ];
    },
    solids: ({ w, d, h }) => {
      const legW = clamp(Math.min(w, d) * 0.43, 300, 600);
      return [box(0, 0, 0, w, legW, h), box(w - legW, legW, 0, legW, d - legW, h)];
    },
  },
  {
    id: 'partition-screen',
    label: 'Partition screen',
    category: 'office',
    defaults: { w: 1400, d: 60, h: 1400 },
    min: { w: 600, d: 30, h: 400 },
    max: { w: 3000, d: 150, h: 2000 },
    plan: ({ w, d }) => [rect(0, 0, w, d, 'outline', Math.min(d / 2, w / 2))],
    solids: ({ w, d, h }) => [box(0, 0, Math.max(0, h > 1000 ? 0 : 700), w, d, h)],
  },
  {
    id: 'whiteboard',
    label: 'Whiteboard',
    category: 'office',
    defaults: { w: 1800, d: 80, h: 1200 },
    min: { w: 600, d: 40, h: 600 },
    max: { w: 4000, d: 120, h: 1500 },
    plan: ({ w, d }) => [rect(0, 0, w, d, 'outline'), line(0, d * 0.5, w, d * 0.5, 'detail')],
    solids: ({ w, d, h }) => [box(0, 0, 900, w, d, h)],
  },

  // ---- IT and comms ------------------------------------------------------
  {
    id: 'server-rack',
    label: 'Server rack',
    category: 'it',
    defaults: { w: 600, d: 1000, h: 2000 },
    min: { w: 550, d: 600, h: 600 },
    max: { w: 800, d: 1200, h: 2200 },
    plan: ({ w, d }) => [
      rect(0, 0, w, d, 'outline'),
      // The 19-inch mounting rails inside the enclosure.
      rect(clamp(w * 0.08, 30, 60), clamp(d * 0.06, 30, 60), w - 2 * clamp(w * 0.08, 30, 60), d - 2 * clamp(d * 0.06, 30, 60), 'detail'),
      // Front face heavier, so which way it is serviced is readable.
      line(0, d, w, d, 'outline'),
      text(w / 2, d * 0.5, 'RACK', 1.6),
    ],
    solids: ({ w, d, h }) => [box(0, 0, 0, w, d, h)],
  },
  {
    id: 'comms-cabinet',
    label: 'Comms cabinet',
    category: 'it',
    defaults: { w: 600, d: 450, h: 600 },
    min: { w: 400, d: 300, h: 300 },
    max: { w: 800, d: 600, h: 1000 },
    plan: ({ w, d }) => [
      // Wall-mounted above the cut plane, like the overhead units.
      rect(0, 0, w, d, 'detail', 0, true),
      text(w / 2, d / 2, 'ND', 1.5),
    ],
    solids: ({ w, d, h }) => [box(0, 0, 1600, w, d, h)],
  },
  {
    id: 'ups',
    label: 'UPS',
    category: 'it',
    defaults: { w: 450, d: 700, h: 900 },
    min: { w: 250, d: 300, h: 200 },
    max: { w: 800, d: 1000, h: 1600 },
    plan: ({ w, d }) => [
      rect(0, 0, w, d, 'outline'),
      line(w * 0.2, d * 0.2, w * 0.8, d * 0.2, 'detail'),
      text(w / 2, d * 0.6, 'UPS', 1.5),
    ],
    solids: ({ w, d, h }) => [box(0, 0, 0, w, d, h)],
  },
  {
    id: 'printer-mfd',
    label: 'Printer / copier',
    category: 'it',
    defaults: { w: 650, d: 450, h: 1100 },
    min: { w: 400, d: 350, h: 200 },
    max: { w: 900, d: 800, h: 1400 },
    plan: ({ w, d }) => {
      // The output tray overhangs the body, so it is drawn hidden.
      const tray = clamp(d * 0.3, 80, 160);
      return [
        rect(0, 0, w, d, 'outline'),
        rect(w * 0.1, Math.max(0, d - tray), w * 0.8, tray, 'detail', 0, true),
        text(w / 2, d * 0.35, 'PRINTER', 1.5),
      ];
    },
    solids: ({ w, d, h }) => [box(0, 0, 0, w, d, h)],
  },
  {
    id: 'desktop-tower',
    label: 'Desktop tower',
    category: 'it',
    defaults: { w: 200, d: 450, h: 450 },
    min: { w: 100, d: 250, h: 250 },
    max: { w: 300, d: 600, h: 600 },
    plan: ({ w, d }) => [rect(0, 0, w, d, 'outline'), line(0, d * 0.18, w, d * 0.18, 'detail')],
    solids: ({ w, d, h }) => [box(0, 0, 0, w, d, h)],
  },
  {
    id: 'floor-box',
    label: 'Floor service box',
    category: 'it',
    defaults: { w: 300, d: 300, h: 20 },
    min: { w: 150, d: 150, h: 10 },
    max: { w: 600, d: 600, h: 60 },
    plan: ({ w, d }) => [
      rect(0, 0, w, d, 'outline'),
      line(0, 0, w, d, 'detail'),
      line(w, 0, 0, d, 'detail'),
    ],
    solids: ({ w, d, h }) => [box(0, 0, 0, w, d, h)],
  },
];

export const FURNITURE_BY_ID: ReadonlyMap<string, FurnitureType> = new Map(FURNITURE.map((f) => [f.id, f]));

/** Clamp a requested size to the item's limits (and keep round tables round). */
export function normaliseSize(item: FurnitureType, s: Partial<Size>): Size {
  const w = clamp(s.w ?? item.defaults.w, item.min.w, item.max.w);
  const d = item.keepSquare ? w : clamp(s.d ?? item.defaults.d, item.min.d, item.max.d);
  const h = clamp(s.h ?? item.defaults.h, item.min.h, item.max.h);
  return { w, d, h };
}

// ---------------------------------------------------------------------------
// Flatten: primitives -> polylines + text runs (what the PDF writer draws)
// ---------------------------------------------------------------------------

export type Pt = readonly [number, number];

export interface Stroke {
  points: Pt[];
  closed: boolean;
  pen: Pen;
  dashed: boolean;
}

export interface TextRun {
  x: number;
  y: number;
  text: string;
  sizeMm: number;
  angleDeg: number;
}

export interface FlatSymbol {
  strokes: Stroke[];
  texts: TextRun[];
  /** Labels that do not fit inside the footprint at this scale. Reported, never squeezed. */
  dropped: string[];
}

/** Rough cap-height text width for Helvetica-like fonts, in paper mm. */
const CHAR_WIDTH_EM = 0.62;

function arcPoints(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, segments: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = a0 + ((a1 - a0) * i) / segments;
    pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return pts;
}

function rectPoints(x: number, y: number, w: number, h: number, r: number): Pt[] {
  const rr = Math.min(r, w / 2, h / 2);
  if (rr <= 0) return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  const seg = 6;
  const q = Math.PI / 2;
  return [
    ...arcPoints(x + w - rr, y + rr, rr, rr, -q, 0, seg),
    ...arcPoints(x + w - rr, y + h - rr, rr, rr, 0, q, seg),
    ...arcPoints(x + rr, y + h - rr, rr, rr, q, 2 * q, seg),
    ...arcPoints(x + rr, y + rr, rr, rr, 2 * q, 3 * q, seg),
  ];
}

/**
 * @param scale drawing scale denominator (100 for 1:100). Only used to decide
 *              whether a text label fits inside the footprint.
 */
export function flattenSymbol(prims: readonly PlanPrimitive[], size: Size, scale: number): FlatSymbol {
  const out: FlatSymbol = { strokes: [], texts: [], dropped: [] };
  for (const p of prims) {
    switch (p.kind) {
      case 'line':
        out.strokes.push({ points: [[p.x1, p.y1], [p.x2, p.y2]], closed: false, pen: p.pen, dashed: p.dashed ?? false });
        break;
      case 'rect':
        out.strokes.push({ points: rectPoints(p.x, p.y, p.w, p.h, p.r), closed: true, pen: p.pen, dashed: p.dashed ?? false });
        break;
      case 'poly':
        out.strokes.push({
          points: p.points.map((pt) => [pt[0], pt[1]] as Pt),
          closed: p.closed,
          pen: p.pen,
          dashed: p.dashed ?? false,
        });
        break;
      case 'ellipse': {
        const pts = arcPoints(p.cx, p.cy, p.rx, p.ry, 0, 2 * Math.PI, 48);
        pts.pop(); // last point repeats the first
        out.strokes.push({ points: pts, closed: true, pen: p.pen, dashed: p.dashed ?? false });
        break;
      }
      case 'text': {
        const widthModel = p.text.length * p.sizeMm * CHAR_WIDTH_EM * scale;
        const heightModel = p.sizeMm * scale;
        const along = p.angleDeg % 180 === 0 ? size.w : size.d;
        const across = p.angleDeg % 180 === 0 ? size.d : size.w;
        if (widthModel > along * 0.9 || heightModel > across * 0.6) {
          out.dropped.push(p.text);
        } else {
          out.texts.push({ x: p.x, y: p.y, text: p.text, sizeMm: p.sizeMm, angleDeg: p.angleDeg });
        }
        break;
      }
    }
  }
  return out;
}

/** Plan geometry for one placed item, ready to draw. */
export function furnitureSymbol(id: string, requested: Partial<Size>, scale: number): FlatSymbol & { size: Size } {
  const item = FURNITURE_BY_ID.get(id);
  if (!item) throw new Error(`Unknown furniture type: ${id}`);
  const size = normaliseSize(item, requested);
  return { ...flattenSymbol(item.plan(size), size, scale), size };
}

// ---------------------------------------------------------------------------
// Placement: item-local -> plan coordinates
// ---------------------------------------------------------------------------

export type Mapper = (x: number, y: number) => Pt;

/**
 * Maps item-local mm to plan mm for an item whose footprint CENTRE sits at
 * (cx, cy) in plan, rotated by `rotationDeg` (counter-clockwise, plan y up).
 * At rotation 0 the item's back edge faces +y (up the page) and its front
 * faces -y. Check this against how Pascal stores item rotation before wiring.
 */
export function itemToPlan(size: Size, cx: number, cy: number, rotationDeg: number): Mapper {
  const a = (rotationDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return (x, y) => {
    const lx = x - size.w / 2;
    const ly = size.d / 2 - y; // back edge (y = 0) goes to +y in plan
    return [cx + lx * c - ly * s, cy + lx * s + ly * c];
  };
}

// ---------------------------------------------------------------------------
// PDF adapter (structural type, so this file needs no pdfkit import)
// ---------------------------------------------------------------------------

/** The subset of PDFKit.PDFDocument this adapter uses. */
export interface PdfLike {
  save(): this;
  restore(): this;
  moveTo(x: number, y: number): this;
  lineTo(x: number, y: number): this;
  closePath(): this;
  lineWidth(w: number): this;
  dash(length: number, options?: { space?: number }): this;
  undash(): this;
  stroke(): this;
  rotate(angle: number, options?: { origin?: [number, number] }): this;
  fontSize(size: number): this;
  text(text: string, x: number, y: number, options?: Record<string, unknown>): this;
}

const MM_TO_PT = 72 / 25.4;

/**
 * Draw a flattened symbol. `toPaper` maps item-local mm to PDF points (compose
 * itemToPlan with your plan->paper mapping from derive-plan). `penMm` comes
 * from pens.ts. Text is never mirrored and is turned to read from the bottom
 * or the right of the sheet.
 */
export function drawSymbolPdf(doc: PdfLike, flat: FlatSymbol, toPaper: Mapper, penMm: Record<Pen, number>): void {
  for (const s of flat.strokes) {
    if (s.points.length < 2) continue;
    doc.save();
    doc.lineWidth(penMm[s.pen] * MM_TO_PT);
    if (s.dashed) doc.dash(1.2 * MM_TO_PT, { space: 0.8 * MM_TO_PT });
    const [x0, y0] = toPaper(s.points[0][0], s.points[0][1]);
    doc.moveTo(x0, y0);
    for (let i = 1; i < s.points.length; i++) {
      const [x, y] = toPaper(s.points[i][0], s.points[i][1]);
      doc.lineTo(x, y);
    }
    if (s.closed) doc.closePath();
    doc.stroke();
    if (s.dashed) doc.undash();
    doc.restore();
  }
  for (const t of flat.texts) {
    const rad = (t.angleDeg * Math.PI) / 180;
    const [px, py] = toPaper(t.x, t.y);
    const [qx, qy] = toPaper(t.x + Math.cos(rad), t.y + Math.sin(rad));
    let angle = (Math.atan2(qy - py, qx - px) * 180) / Math.PI; // PDF y-down, clockwise positive
    if (angle >= 90) angle -= 180;
    if (angle < -90) angle += 180;
    const pt = t.sizeMm * MM_TO_PT;
    const boxW = t.text.length * pt * 0.75;
    doc.save();
    doc.rotate(angle, { origin: [px, py] });
    doc.fontSize(pt);
    doc.text(t.text, px - boxW / 2, py, { width: boxW, align: 'center', lineBreak: false, baseline: 'middle' });
    doc.restore();
  }
}

// ---------------------------------------------------------------------------
// Catalogue thumbnail: an SVG string drawn from the same plan symbol
// ---------------------------------------------------------------------------

/** A thumbnail's geometry, ready for either an SVG string or JSX elements. */
export interface Thumbnail {
  /** SVG viewBox covering the footprint plus a small margin. */
  viewBox: string;
  /** Stroke width for one screen unit at this viewBox, so lines stay even. */
  unit: number;
  paths: { d: string; pen: Pen; dashed: boolean }[];
  texts: TextRun[];
}

/**
 * The catalogue picture, drawn from the same `plan()` as the sheet.
 *
 * Shared by `thumbnailSvg` and the catalogue panel so a tile cannot drift
 * from the drawing it is advertising. Flattened at 1:50, the scale a tile is
 * effectively viewed at, so a label that survives on a plan survives here.
 */
export function thumbnailGeometry(id: string): Thumbnail {
  const item = FURNITURE_BY_ID.get(id);
  if (!item) throw new Error(`Unknown furniture type: ${id}`);
  const size = item.defaults;
  const flat = flattenSymbol(item.plan(size), size, 50);
  const pad = Math.max(size.w, size.d) * 0.08;
  return {
    viewBox: `${-pad} ${-pad} ${size.w + 2 * pad} ${size.d + 2 * pad}`,
    unit: Math.max(size.w, size.d) / 120,
    paths: flat.strokes.map((s) => ({
      d:
        s.points.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('') +
        (s.closed ? 'Z' : ''),
      pen: s.pen,
      dashed: s.dashed,
    })),
    texts: flat.texts,
  };
}

/** Small SVG for the catalogue panel. No image files, no bucket. */
export function thumbnailSvg(id: string, px = 96): string {
  const { viewBox, unit, paths, texts } = thumbnailGeometry(id);
  const body = paths
    .map((p) => {
      const sw = (p.pen === 'outline' ? 2 : 1) * unit;
      const dash = p.dashed ? ` stroke-dasharray="${6 * unit} ${4 * unit}"` : '';
      return `<path d="${p.d}" stroke-width="${sw.toFixed(1)}"${dash}/>`;
    })
    .join('');
  const labels = texts
    .map((t) => `<text x="${t.x}" y="${t.y}" font-size="${t.sizeMm * 50}" text-anchor="middle" dominant-baseline="middle" stroke="none" fill="currentColor" font-family="Helvetica, Arial, sans-serif">${t.text}</text>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-linejoin="round">${body}${labels}</svg>`;
}

// ---------------------------------------------------------------------------
// Invariant: every plan primitive stays inside its footprint
// ---------------------------------------------------------------------------

/** Returns the ids (with sizes) whose symbol leaves the footprint. Empty = pass. */
export function checkFootprint(sizes: (item: FurnitureType) => Size[] = (i) => [i.defaults, i.min, i.max]): string[] {
  const failures: string[] = [];
  const EPS = 0.01;
  for (const item of FURNITURE) {
    for (const raw of sizes(item)) {
      const size = normaliseSize(item, raw);
      const flat = flattenSymbol(item.plan(size), size, 100);
      const outside = flat.strokes.some((s) => s.points.some(([x, y]) => x < -EPS || y < -EPS || x > size.w + EPS || y > size.d + EPS));
      const solidOutside = item.solids(size).some((sd) =>
        sd.kind === 'box'
          ? sd.x < -EPS || sd.y < -EPS || sd.x + sd.w > size.w + EPS || sd.y + sd.d > size.d + EPS || sd.z < 0
          : sd.cx - sd.r < -EPS || sd.cy - sd.r < -EPS || sd.cx + sd.r > size.w + EPS || sd.cy + sd.r > size.d + EPS || sd.z < 0,
      );
      if (outside || solidOutside) failures.push(`${item.id} @ ${size.w}x${size.d}${outside ? ' (plan)' : ''}${solidOutside ? ' (3D)' : ''}`);
    }
  }
  return failures;
}
