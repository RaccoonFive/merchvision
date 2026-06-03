import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
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

export default nextConfig;
