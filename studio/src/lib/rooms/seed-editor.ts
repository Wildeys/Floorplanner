"use client";

/**
 * Load room GF-03.4.09 into the editor as real, editable scene nodes.
 *
 * The sheet pipeline can take the room spec as plain geometry, but the editor
 * stores schema-validated nodes, and its furniture is catalogue-backed: an item
 * carries an asset (model, thumbnail, intrinsic size) and a scale, not a bare
 * width and depth. So each piece of fit-out is instanced from the catalogue
 * entry named in the room module and scaled to the footprint the spec asks for.
 */

import { AnyNode, useScene } from "@pascal-app/core";
import { CATALOG_ITEMS, selectDefaultBuildingAndLevel } from "@pascal-app/editor";

import { CEILING, FURNITURE, OPENINGS, WALLS, type FurnitureSpec } from "./gf-03-4-09.ts";

const SITE_ID = "site_gf03409";
const BUILDING_ID = "building_gf03409";
const LEVEL_ID = "level_gf03409";

type CatalogItem = (typeof CATALOG_ITEMS)[number];

function catalogItem(id: string): CatalogItem | undefined {
  return CATALOG_ITEMS.find((entry) => entry.id === id);
}

/**
 * Scale a catalogue asset to the footprint the spec wants.
 *
 * A quarter-turn swaps which asset axis ends up running east, so the wanted
 * width and depth swap with it. Height is left alone — the spec is a plan and
 * says nothing about it.
 */
function footprintScale(piece: FurnitureSpec, asset: CatalogItem): [number, number, number] {
  const [ax, , az] = asset.dimensions ?? [1, 1, 1];
  const quarterTurned = piece.faceDeg % 180 !== 0;
  const wantX = quarterTurned ? piece.d : piece.w;
  const wantZ = quarterTurned ? piece.w : piece.d;
  return [wantX / (ax || 1), 1, wantZ / (az || 1)];
}

/** Build the whole room as validated nodes, parented to one level. */
function buildNodes(): Record<string, unknown> {
  const childIds: string[] = [];
  const raw: Record<string, unknown>[] = [
    // site -> building -> level is the tree the editor expects: it looks for
    // the first building under the root site node when deciding which level to
    // open, and skips the whole step if the root is anything else.
    {
      object: "node",
      id: SITE_ID,
      type: "site",
      name: "Site",
      parentId: null,
      children: [BUILDING_ID],
    },
    {
      object: "node",
      id: BUILDING_ID,
      type: "building",
      name: "GF-03.4.09",
      parentId: SITE_ID,
      children: [LEVEL_ID],
    },
    {
      object: "node",
      id: LEVEL_ID,
      type: "level",
      name: `Ground — ${CEILING}`,
      parentId: BUILDING_ID,
      // `level: 0` is what marks this as the ground storey; the editor looks
      // for it when choosing which level to open.
      level: 0,
      baseElevation: 0,
      height: 2.7,
      children: childIds,
    },
  ];

  for (const wall of WALLS) {
    raw.push({
      object: "node",
      id: `wall_${wall.id}`,
      type: "wall",
      parentId: LEVEL_ID,
      start: [wall.start[0], wall.start[1]],
      end: [wall.end[0], wall.end[1]],
      thickness: wall.thickness,
      height: 2.7,
    });
    childIds.push(`wall_${wall.id}`);
  }

  for (const opening of OPENINGS) {
    raw.push({
      object: "node",
      id: `${opening.type}_${opening.id}`,
      type: opening.type,
      parentId: LEVEL_ID,
      wallId: `wall_${opening.wallId}`,
      width: opening.width,
      height: opening.height,
      position: [opening.along, 0, 0],
      hingesSide: opening.hingesSide,
      swingDirection: opening.swingDirection,
    });
    childIds.push(`${opening.type}_${opening.id}`);
  }

  for (const piece of FURNITURE) {
    const asset = catalogItem(piece.catalogId);
    if (!asset) continue;
    raw.push({
      object: "node",
      id: `item_${piece.id}`,
      type: "item",
      parentId: LEVEL_ID,
      name: piece.name,
      position: [piece.x, 0, piece.z],
      rotation: [0, (piece.faceDeg * Math.PI) / 180, 0],
      scale: footprintScale(piece, asset),
      asset,
    });
    childIds.push(`item_${piece.id}`);
  }

  const nodes: Record<string, unknown> = {};
  for (const node of raw) {
    const parsed = AnyNode.safeParse(node);
    if (!parsed.success) {
      console.warn(`[room] skipped ${String(node.id)}:`, parsed.error.issues[0]?.message);
      continue;
    }
    nodes[parsed.data.id] = parsed.data;
  }
  return nodes;
}

/** Replace whatever is on the canvas with this room. */
export function seedRoomGf03409(): number {
  const nodes = buildNodes();
  const store = useScene.getState() as unknown as {
    setScene: (nodes: Record<string, unknown>, rootNodeIds: string[]) => void;
  };
  store.setScene(nodes, [SITE_ID]);
  // Without this the canvas comes up on no level at all and shows
  // "Switch to a building level to view and edit the floorplan."
  selectDefaultBuildingAndLevel({ forceGroundLevel: true });
  return Object.keys(nodes).length;
}
