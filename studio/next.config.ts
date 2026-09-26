import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @pascal-app/editor publishes raw .tsx source (its package.json "exports"
  // points at ./src/index.tsx, not a dist build), so Next has to compile it
  // with our own toolchain rather than treating it as a prebuilt dependency.
  transpilePackages: ["@pascal-app/editor"],

  typescript: {
    // Because we compile that package's source, Next's build-time check also
    // type-checks it — and it has a pre-existing upstream error. Our own code
    // is still gated strictly by `npm run typecheck`, which `npm run build`
    // runs first; see scripts/typecheck.mjs.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
