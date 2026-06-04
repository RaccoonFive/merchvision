import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import path from "node:path";

export default function nextConfig(phase: string): NextConfig {
  return {
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
    outputFileTracingRoot: path.resolve(__dirname),
    images: {
      remotePatterns: [
        {
          protocol: "https",
          hostname: "oldschool.runescape.wiki",
          pathname: "/images/**"
        }
      ]
    }
  };
}
