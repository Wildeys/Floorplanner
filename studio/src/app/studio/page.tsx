"use client";

import dynamic from "next/dynamic";

// The editor owns a WebGL/WebGPU canvas and touches browser-only globals during
// module init, so it must never be server-rendered. `ssr: false` is only legal
// inside a Client Component, which is why this page is one.
const StudioShell = dynamic(() => import("@/components/studio-shell"), {
  ssr: false,
  loading: () => (
    <div className="studio-shell relative flex h-full items-center justify-center">
      <div className="studio-backdrop" aria-hidden="true" />
      <p className="relative text-sm" style={{ color: "var(--ink-muted)" }}>
        Loading studio…
      </p>
    </div>
  ),
});

export default function StudioPage() {
  return (
    <main className="h-dvh w-full">
      <StudioShell />
    </main>
  );
}
