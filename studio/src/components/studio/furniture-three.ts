/**
 * furniture-three.ts
 *
 * Builds one merged BufferGeometry per furniture item from its `solids()`.
 * Load this lazily from the renderer module so it never touches the sheet
 * pipeline or the initial bundle.
 *
 * Axes: item-local x -> three x, item-local y (back -> front) -> three z,
 * height -> three y. The geometry is centred on the footprint centre and sits
 * on y = 0, so it drops straight into an item node's group.
 *
 * Cache by `${id}:${w}x${d}x${h}`: forty identical balcony chairs share one
 * geometry, and an InstancedMesh per key (as Pascal's Nature plugin does)
 * keeps them to a single draw call.
 */
import { BoxGeometry, BufferGeometry, CylinderGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FURNITURE_BY_ID, normaliseSize, type Size } from '@/lib/sheets/furniture-library';

const cache = new Map<string, BufferGeometry>();

export function furnitureGeometry(id: string, requested: Partial<Size>): BufferGeometry {
  const item = FURNITURE_BY_ID.get(id);
  if (!item) throw new Error(`Unknown furniture type: ${id}`);
  const size = normaliseSize(item, requested);
  const key = `${id}:${size.w}x${size.d}x${size.h}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const MM = 0.001; // scene units are metres
  const parts: BufferGeometry[] = item.solids(size).map((s) => {
    if (s.kind === 'box') {
      const g = new BoxGeometry(s.w * MM, s.h * MM, s.d * MM);
      g.translate((s.x + s.w / 2 - size.w / 2) * MM, (s.z + s.h / 2) * MM, (s.y + s.d / 2 - size.d / 2) * MM);
      return g;
    }
    const g = new CylinderGeometry(s.r * MM, s.r * MM, s.h * MM, 24);
    g.translate((s.cx - size.w / 2) * MM, (s.z + s.h / 2) * MM, (s.cy - size.d / 2) * MM);
    return g;
  });

  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!merged) throw new Error(`Could not merge geometry for ${id}`);
  cache.set(key, merged);
  return merged;
}
