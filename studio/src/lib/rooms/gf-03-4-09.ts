/**
 * Room GF-03.4.09 — office fit-out, transcribed from the issued spec.
 *
 * `gf-03-4-09.spec.json` is the authority for every number here; this module
 * only converts it into the shapes the rest of the studio speaks:
 *
 *   - millimetres become metres
 *   - spec rects are `{x, y, w, h}` about their south-west corner; scene items
 *     carry a centre and a size, so each rect is re-centred
 *   - the perimeter is given as four wall *rects*, but walls in the scene model
 *     are centrelines with a thickness, so the loop is rebuilt from the clear
 *     interior grown by half a wall
 *
 * The spec puts north at +y. Pascal's world puts north at -Z, so the north axis
 * is negated on the way in: scene z = -spec y. Build the room in the spec's
 * frame and the model comes out mirrored in the editor.
 */

import spec from "./gf-03-4-09.spec.json" with { type: "json" };

/** Millimetres to metres. */
const m = (value: number) => value / 1000;
/** Spec north (+y, millimetres) to scene north (-Z, metres). */
const mz = (value: number) => -value / 1000;

/** Clear internal dimensions, metres. */
export const W = m(spec.room.interior.w);
export const D = m(spec.room.interior.h);
export const WALL = m(spec.existing_elements.walls.thickness_assumed);
/** Offset from a clear face out to the wall centreline. */
const H = WALL / 2;

export const ROOM_ID = spec.room.id;
export const CEILING = spec.room.ceiling_level;
export const AREA_M2 = spec.room.area_m2;

export type WallSpec = {
  readonly id: string;
  readonly start: readonly [number, number];
  readonly end: readonly [number, number];
  readonly thickness: number;
};

export type OpeningSpec = {
  readonly id: string;
  readonly type: "door" | "window";
  readonly wallId: string;
  readonly width: number;
  readonly height: number;
  /** Distance in metres along the host wall from its start point. */
  readonly along: number;
  readonly hingesSide: "left" | "right";
  readonly swingDirection: "inward" | "outward";
};

export type ZoneSpec = {
  readonly id: string;
  readonly name: string;
  readonly polygon: readonly (readonly [number, number])[];
};

/** A rectangular piece of fit-out, centred, in metres. */
export type FurnitureSpec = {
  readonly id: string;
  readonly name: string;
  readonly x: number;
  readonly z: number;
  /** Plan footprint: w along x (east), d along z. Scene z runs south. */
  readonly w: number;
  readonly d: number;
  readonly h: number;
  /** Catalogue entry to instance when seeding the editor. */
  readonly catalogId: string;
  /** Direction the user of it looks, degrees clockwise from north. */
  readonly faceDeg: number;
};

type Rect = { x: number; y: number; w: number; h: number };

function centred(
  id: string,
  name: string,
  rect: Rect,
  h: number,
  catalogId: string,
  faceDeg = 0,
): FurnitureSpec {
  return {
    id,
    name,
    x: m(rect.x + rect.w / 2),
    z: mz(rect.y + rect.h / 2),
    w: m(rect.w),
    d: m(rect.h),
    h,
    catalogId,
    faceDeg,
  };
}

/**
 * The perimeter as a closed centreline loop.
 *
 * The loop runs anticlockwise from the south-west so the north wall is
 * traversed east to west — the door offset below is measured along that
 * direction.
 */
export const WALLS: readonly WallSpec[] = (() => {
  // Written south-west first in the spec's frame, then flipped onto world z.
  const corners: [number, number][] = (
    [
      [-H, -H],
      [W + H, -H],
      [W + H, D + H],
      [-H, D + H],
    ] as [number, number][]
  ).map(([x, y]) => [x, -y] as [number, number]);
  const names = ["south", "east", "north", "west"];
  return corners.map((start, i) => ({
    id: `p_${names[i]}`,
    start,
    end: corners[(i + 1) % 4]!,
    thickness: WALL,
  }));
})();

export const OPENINGS: readonly OpeningSpec[] = (() => {
  const door = spec.existing_elements.door;
  const centreX = m((door.opening.x_from + door.opening.x_to) / 2);
  // p_north runs east -> west, so distances along it count back from the east
  // end. The hinge is the east jamb, which that direction reaches first.
  return [
    {
      id: door.id,
      type: "door" as const,
      wallId: "p_north",
      width: m(door.opening.width),
      height: 2.1,
      along: W + H - centreX,
      hingesSide: "left" as const,
      // Taken from the spec rather than tuned by eye: the derivation reflects
      // world z onto plan y, and flips the swing side along with it.
      swingDirection: door.opens === "inward" ? ("inward" as const) : ("outward" as const),
    },
  ];
})();

export const ZONES: readonly ZoneSpec[] = spec.zones.items.map((zone) => ({
  id: zone.id,
  name: zone.label,
  polygon: [
    [m(zone.x), mz(zone.y)],
    [m(zone.x + zone.w), mz(zone.y)],
    [m(zone.x + zone.w), mz(zone.y + zone.h)],
    [m(zone.x), mz(zone.y + zone.h)],
  ] as const,
}));

/** Heights are not in the spec — these are conventional, and only shape the 3D view. */
const HEIGHT = {
  desk: 0.73,
  chair: 1.1,
  meetingChair: 0.9,
  table: 0.75,
  counter: 0.9,
  storage: 2.0,
  coat: 1.8,
  screen: 1.2,
  appliance: 0.4,
  basin: 0.9,
};

export const FURNITURE: readonly FurnitureSpec[] = (() => {
  const f = spec.furniture;
  const out: FurnitureSpec[] = [];

  // Desks and chairs: every seat faces west (270), per the revision note.
  for (const desk of f.team_desks.items) {
    out.push(centred(desk.id, desk.label, desk, HEIGHT.desk, "office-table", 270));
  }
  for (const chair of f.team_chairs.items) {
    out.push(centred(chair.id, "Task chair", chair.rect, HEIGHT.chair, "office-chair", 270));
  }

  out.push(
    centred(f.supervisor.desk.id, "Supervisor desk", f.supervisor.desk, HEIGHT.desk, "office-table", 270),
  );
  out.push(
    centred(f.supervisor.chair.id, "Supervisor chair", f.supervisor.chair.rect, HEIGHT.chair, "office-chair", 270),
  );

  // Meeting table is round (Ø800); the scene model carries rectangular
  // footprints, so it is placed as its bounding square.
  const table = f.meeting.table;
  out.push(
    centred(
      table.id,
      "Meeting table Ø800",
      {
        x: table.center[0]! - table.radius,
        y: table.center[1]! - table.radius,
        w: table.radius * 2,
        h: table.radius * 2,
      },
      HEIGHT.table,
      "dining-table",
    ),
  );
  for (const chair of f.meeting.chairs.items) {
    const faceDeg =
      chair.backrest_side === "+Y" ? 180 : chair.backrest_side === "-Y" ? 0 : chair.backrest_side === "+X" ? 270 : 90;
    out.push(centred(chair.id, "Meeting chair", chair.rect, HEIGHT.meetingChair, "dining-chair", faceDeg));
  }
  out.push(
    centred(f.meeting.wall_screen.id, "Screen / whiteboard", f.meeting.wall_screen, HEIGHT.screen, "television", 90),
  );

  for (const unit of f.storage.items) {
    out.push(centred(unit.id, unit.label, unit, HEIGHT.storage, "kitchen-cabinet"));
  }
  out.push(centred(f.coat_hooks.id, "Coat hooks", f.coat_hooks, HEIGHT.coat, "kitchen-cabinet"));

  // The pantry counter is an L. Its polyline corners give the two legs:
  // a south run along the basin wall, turning north against the east wall.
  const p = f.pantry.counter.points as [number, number][];
  const southLeg = { x: p[0]![0], y: p[0]![1], w: p[1]![0] - p[0]![0], h: p[5]![1] - p[0]![1] };
  const eastLeg = { x: p[4]![0], y: p[4]![1], w: p[2]![0] - p[4]![0], h: p[3]![1] - p[4]![1] };
  out.push(centred("CTR-01-S", "Counter", southLeg, HEIGHT.counter, "kitchen-counter"));
  out.push(centred("CTR-01-E", "Counter", eastLeg, HEIGHT.counter, "kitchen-counter", 270));

  for (const appliance of f.pantry.items) {
    const catalogId =
      appliance.id.startsWith("COF") ? "coffee-machine" : appliance.id.startsWith("FRG") ? "fridge" : "kettle";
    out.push(centred(appliance.id, appliance.label, appliance, HEIGHT.appliance, catalogId));
  }

  const basin = spec.existing_elements.basin;
  out.push(centred(basin.id, "Sink (existing)", basin, HEIGHT.basin, "bathroom-sink"));

  // The column is existing structure, but it is placed as an item rather than
  // a stub wall: given a centreline that stops short of the perimeter, the
  // mitring solver fuses it into the north-east corner and thickens the walls
  // either side of it.
  const column = spec.existing_elements.column;
  out.push(centred(column.id, column.label, column, 2.7, "column"));

  return out;
})();
