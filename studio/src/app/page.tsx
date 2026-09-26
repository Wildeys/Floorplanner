import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 p-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Online Drawing Studio</h1>
        <p className="text-sm opacity-70">
          Lay out your building, walk through it in 3D, and get an architectural
          drawing set. See <code>REQUIREMENTS.md</code> for scope.
        </p>
      </div>
      <Link
        href="/studio"
        className="w-fit rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
      >
        Open the studio
      </Link>
    </main>
  );
}
