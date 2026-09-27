import Link from "next/link";

export default function Home() {
  return (
    <main className="studio-shell relative flex min-h-dvh flex-1 flex-col items-center justify-center p-8">
      <div className="studio-backdrop" aria-hidden="true" />
      <section className="glass-panel relative z-10 w-full max-w-md px-8 py-10">
        <span className="glass-frost" aria-hidden="true" />
        <div className="glass-content">
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-[15px] font-semibold">Floorplanner</p>
              <h1 className="text-2xl font-semibold">Design your building</h1>
              <p className="text-[13px]" style={{ color: "var(--ink-muted)" }}>
                Design and 3D are free. When you are ready, you can order a
                drawing set.
              </p>
            </div>
            <Link
              href="/studio"
              className="inline-flex rounded-[999px] px-4 py-2 text-[13px] font-medium text-white"
              style={{ background: "var(--accent)" }}
            >
              Open the studio
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
