import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import path from "node:path";

export default function nextConfig(phase: string): NextConfig {
  return {
    // Shared hosting can count every build worker's threads against the account limit.
    ...(process.env.MERCHVISION_CPANEL_BUILD === "1"
      ? { experimental: { cpus: 1, staticGenerationMaxConcurrency: 1 } }
      : {}),
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
    outputFileTracingRoot: path.resolve(__dirname),
    images: {
      qualities: [75, 90],
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
