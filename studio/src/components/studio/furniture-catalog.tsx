"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { CATALOG_ITEMS, activateCatalogItem, useEditor } from "@pascal-app/editor";

import { GlassPanel } from "./glass-panel.tsx";

/** Pascal catalogue groups we surface. Typed locally — the package does not re-export the union. */
type CatalogGroup = "furniture" | "kitchen" | "bathroom" | "appliance" | "outdoor";

const CATEGORIES: readonly { id: CatalogGroup; label: string }[] = [
  { id: "furniture", label: "Furniture" },
  { id: "kitchen", label: "Kitchen" },
  { id: "bathroom", label: "Bathroom" },
  { id: "appliance", label: "Appliances" },
  { id: "outdoor", label: "Outdoor" },
];

/**
 * Customer furniture list (DESIGN.md §13).
 *
 * Clicking a tile arms Pascal's item tool with that catalogue entry; the next
 * click on the plan places it. The built-in ItemsPanel stays unused here
 * because it is styled for the dark sidebar and expects icon files we do not
 * ship.
 */
export function FurnitureCatalog() {
  const catalogCategory = useEditor((s) => s.catalogCategory) ?? "furniture";
  const setCatalogCategory = useEditor((s) => s.setCatalogCategory);
  const selectedItem = useEditor((s) => s.selectedItem);
  const [search, setSearch] = useState("");

  const items = useMemo(() => {
    const query = search.trim().toLowerCase();
    return CATALOG_ITEMS.filter((item) => {
      if (query) return item.name.toLowerCase().includes(query);
      return item.category === catalogCategory;
    });
  }, [catalogCategory, search]);

  return (
    <GlassPanel
      as="aside"
      aria-label="Furniture"
      className="pointer-events-auto flex h-full min-h-0 w-full flex-col overflow-hidden"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
        <h2 className="text-[13px] font-semibold">Furniture</h2>
        <p className="text-[11px] leading-snug" style={{ color: "var(--ink-muted)" }}>
          Click an item, then click the plan to place it.
        </p>

        <label className="flex items-center gap-2 rounded-[16px] px-2 py-1.5" style={{ background: "var(--glass-hover)" }}>
          <Search size={16} strokeWidth={1.75} aria-hidden="true" style={{ color: "var(--ink-muted)" }} />
          <span className="sr-only">Search furniture</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search"
            className="w-full bg-transparent text-[13px] outline-none"
            style={{ color: "var(--ink)" }}
          />
        </label>

        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Furniture category">
          {CATEGORIES.map((category) => {
            const active = !search && catalogCategory === category.id;
            return (
              <button
                key={category.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setSearch("");
                  setCatalogCategory(category.id);
                }}
                className="rounded-[999px] px-2.5 py-1 text-[11px] font-medium"
                style={{
                  background: active ? "var(--accent-soft)" : "transparent",
                  color: active ? "var(--accent)" : "var(--ink-muted)",
                }}
              >
                {category.label}
              </button>
            );
          })}
        </div>

        <ul className="grid min-h-0 flex-1 grid-cols-2 content-start gap-2 overflow-y-auto">
          {items.map((item) => {
            const selected = selectedItem?.id === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => activateCatalogItem(item)}
                  aria-pressed={selected}
                  className="flex w-full flex-col gap-1 rounded-[16px] p-1.5 text-left transition-colors hover:bg-[var(--glass-hover)]"
                  style={{
                    background: selected ? "var(--accent-soft)" : undefined,
                    boxShadow: selected ? "inset 0 0 0 1px var(--accent)" : undefined,
                  }}
                >
                  <span className="relative aspect-square w-full overflow-hidden rounded-[12px] bg-white/70">
                    {item.thumbnail ? (
                      // Catalogue thumbnails are remote assets on the item CDN.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.thumbnail}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </span>
                  <span className="truncate px-0.5 text-[11px] font-medium">{item.name}</span>
                  {item.dimensions ? (
                    <span className="px-0.5 text-[11px]" style={{ color: "var(--ink-muted)" }}>
                      {Math.round(item.dimensions[0] * 1000)} × {Math.round(item.dimensions[2] * 1000)} mm
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>

        {items.length === 0 ? (
          <p className="text-[13px]" style={{ color: "var(--ink-muted)" }}>
            No items match that search.
          </p>
        ) : null}
      </div>
    </GlassPanel>
  );
}
