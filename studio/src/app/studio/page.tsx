"use client";

import dynamic from "next/dynamic";

// The editor owns a WebGL/WebGPU canvas and touches browser-only globals during
// module init, so it must never be server-rendered. `ssr: false` is only legal
// inside a Client Component, which is why this page is one.
const StudioShell = dynamic(() => import("@/components/studio-shell"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <p className="text-sm opacity-60">Loading studio…</p>
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
