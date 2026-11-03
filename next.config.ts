import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const nextConfig: NextConfig = {
  // Dev via static Cloudflare tunnel or Tailscale
  allowedDevOrigins: [
    "*.mocci.web.id",
    "127.0.0.1",
    "localhost",
    "127.0.0.1:3010",
    "localhost:3010",
    "vesper.tailf6c5fc.ts.net",
    "vesper.tailf6c5fc.ts.net:3010",
    "*.ts.net",
  ],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default function config(phase: string): NextConfig {
  return {
    ...nextConfig,
    // Keep production builds from changing the running dev server's artifacts.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
  };
}
