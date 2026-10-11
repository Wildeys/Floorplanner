import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @pascal-app/editor publishes raw .tsx source (its package.json "exports"
  // points at ./src/index.tsx, not a dist build), so Next has to compile it
  // with our own toolchain rather than treating it as a prebuilt dependency.
  transpilePackages: ["@pascal-app/editor"],

  // Placed furniture thumbnails are remote catalogue assets. next/image
  // refuses them until the host is listed (the inspector tree uses Image).
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "byrpxoiotywskoojsrzd.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
