"use client";

import type { CSSProperties, ReactNode } from "react";

/**
 * The two-layer glass surface every chrome panel is built from (DESIGN.md §3.2).
 *
 * The frost layer samples the backdrop and carries the refraction filter; the
 * content layer sits above it and is never displaced, so labels and focus rings
 * stay sharp. Keeping them as separate elements is what makes that guarantee
 * structural rather than a matter of getting a filter's parameters right.
 */
export function GlassPanel({
  children,
  className = "",
  style,
  as: Tag = "div",
  role,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  as?: "div" | "header" | "aside" | "section" | "nav";
  role?: string;
  "aria-label"?: string;
}) {
  return (
    <Tag className={`glass-panel ${className}`} style={style} role={role} aria-label={ariaLabel}>
      <span className="glass-frost" aria-hidden="true" />
      <div className="glass-content">{children}</div>
    </Tag>
  );
}
