import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @pascal-app/editor publishes raw .tsx source (its package.json "exports"
  // points at ./src/index.tsx, not a dist build), so Next has to compile it
  // with our own toolchain rather than treating it as a prebuilt dependency.
  transpilePackages: ["@pascal-app/editor"],
};

export default nextConfig;
