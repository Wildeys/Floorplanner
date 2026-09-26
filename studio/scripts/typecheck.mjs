#!/usr/bin/env node
/**
 * Typecheck gate for our own source.
 *
 * `@pascal-app/editor` ships raw .tsx source rather than a compiled build with
 * .d.ts files, so TypeScript follows our imports straight into that package and
 * checks it as if it were ours. It currently has an upstream error
 * (`new QuadMesh()` in lib/export-texture-utils.ts does not satisfy the
 * constructor signature in the three@0.186 types it declares as a peer), and
 * `skipLibCheck` cannot help because these are .ts sources, not declarations.
 *
 * Rather than disable type safety for the whole project, this runs the full
 * check and fails only on diagnostics originating outside node_modules. Errors
 * inside vendored packages are reported as warnings so regressions there stay
 * visible instead of silently accumulating.
 */
import { spawnSync } from "node:child_process";

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["tsc", "--noEmit", "--pretty", "false"],
  { encoding: "utf8", shell: process.platform === "win32" },
);

if (result.error) {
  console.error("Failed to run tsc:", result.error.message);
  process.exit(1);
}

const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
const lines = output.split(/\r?\n/).filter((line) => line.trim().length > 0);

const isDiagnostic = (line) => /error TS\d+:/.test(line);
const isVendored = (line) => /(^|[\\/])node_modules[\\/]/.test(line.split("(")[0]);

const ours = lines.filter((l) => isDiagnostic(l) && !isVendored(l));
const vendored = lines.filter((l) => isDiagnostic(l) && isVendored(l));

if (vendored.length > 0) {
  console.warn(
    `\n${vendored.length} pre-existing type error(s) inside node_modules (not ours, not gating):`,
  );
  for (const line of vendored) console.warn(`  ${line}`);
}

if (ours.length > 0) {
  console.error(`\n${ours.length} type error(s) in our source:\n`);
  for (const line of ours) console.error(`  ${line}`);
  process.exit(1);
}

console.log("\nTypecheck passed: no type errors in our source.");
