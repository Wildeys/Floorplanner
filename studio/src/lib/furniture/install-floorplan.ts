"use client";

/**
 * Draw library plan symbols on the 2D floor, in place of catalogue photos.
 *
 * The item kind's floorplan stays responsible for placement, hit-testing and
 * the selection ring. This only swaps the picture for the same strokes the
 * PDF uses.
 */

import { nodeRegistry, type FloorplanGeometry } from "@pascal-app/core/registry";

import { PEN } from "../sheets/pens.ts";
import { resolveLibraryId, symbolInFootprint, type SymbolIdentity } from "./plan-symbol.ts";

type FloorplanNode = {
  kind: string;
  points?: readonly (readonly [number, number])[];
  children?: FloorplanNode[];
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  vectorEffect?: "non-scaling-stroke";
  fillOpacity?: number;
  text?: string;
  x?: number;
  y?: number;
  fontSize?: number;
  textAnchor?: "middle";
  dominantBaseline?: "middle";
};

const INK = "#1a1a1a";

function isFootprint(node: FloorplanNode): boolean {
  return node.kind === "polygon" && (node.points?.length ?? 0) >= 4 && node.fill !== "none";
}

function symbolNodes(identity: SymbolIdentity, corners: readonly (readonly [number, number])[]): FloorplanNode[] {
  const libraryId = resolveLibraryId(identity);
  if (!libraryId) return [];
  const symbol = symbolInFootprint(libraryId, corners);
  if (!symbol) return [];

  const nodes: FloorplanNode[] = [];
  for (const polygon of symbol.polygons) {
    nodes.push({
      kind: "polygon",
      points: polygon.points,
      fill: "none",
      stroke: INK,
      strokeWidth: polygon.weightMm === PEN.symbol ? 1 : 1.35,
      vectorEffect: "non-scaling-stroke",
    });
  }
  for (const path of symbol.paths) {
    nodes.push({
      kind: "polyline",
      points: path.points,
      fill: "none",
      stroke: INK,
      strokeWidth: path.weightMm === PEN.symbol ? 1 : 1.35,
      strokeDasharray: path.dashed ? "0.05 0.035" : undefined,
      vectorEffect: "non-scaling-stroke",
    });
  }
  for (const label of symbol.labels) {
    nodes.push({
      kind: "text",
      x: label.at[0],
      y: label.at[1],
      text: label.text,
      fontSize: (label.sizeMm ?? 1.6) * 0.1,
      fill: INK,
      textAnchor: "middle",
      dominantBaseline: "middle",
    });
  }
  return nodes;
}

function withPlanSymbol(node: SymbolIdentity, geometry: FloorplanGeometry | null): FloorplanGeometry | null {
  if (!geometry || geometry.kind !== "group" || !Array.isArray(geometry.children)) return geometry;
  const children = (geometry.children as FloorplanNode[]).filter((child) => child.kind !== "image");
  const footprint = children.find(isFootprint);
  if (!footprint?.points) return { ...geometry, children } as FloorplanGeometry;

  const symbol = symbolNodes(node, footprint.points);
  if (symbol.length > 0) {
    footprint.fill = "transparent";
    footprint.stroke = "none";
    footprint.strokeWidth = 0;
    const index = children.indexOf(footprint);
    children.splice(index + 1, 0, ...symbol);
  } else {
    // No library symbol: a plain outline, the same fallback the PDF uses.
    footprint.fill = "transparent";
    footprint.stroke = INK;
    footprint.strokeWidth = 1.35;
    footprint.vectorEffect = "non-scaling-stroke";
  }
  return { ...geometry, children } as FloorplanGeometry;
}

let installed = false;

/** Replace catalogue floor-plan images with library symbols. Idempotent. */
export function installFurniturePlanSymbols(): void {
  if (installed) return;
  const definition = nodeRegistry.get("item");
  if (!definition?.floorplan) return;
  installed = true;
  const original = definition.floorplan.bind(definition);
  definition.floorplan = ((node, ctx) => {
    const geometry = original(node, ctx);
    return withPlanSymbol(node as SymbolIdentity, geometry);
  }) as typeof definition.floorplan;
}
