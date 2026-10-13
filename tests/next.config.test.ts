import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from "next/constants";
import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig from "@/next.config";

afterEach(() => vi.unstubAllEnvs());

describe("shared-hosting build configuration", () => {
  it("limits page workers and page concurrency when the cPanel build flag is enabled", () => {
    vi.stubEnv("MERCHVISION_CPANEL_BUILD", "1");
    const config = nextConfig(PHASE_PRODUCTION_BUILD);
    expect(config.experimental).toMatchObject({ cpus: 1, staticGenerationMaxConcurrency: 1 });
    expect(config.distDir).toBe(".next");
  });

  it("keeps the normal build's concurrency defaults unless explicitly enabled", () => {
    for (const value of [undefined, "0"]) {
      vi.stubEnv("MERCHVISION_CPANEL_BUILD", value);
      expect(nextConfig(PHASE_PRODUCTION_BUILD).experimental).toBeUndefined();
    }
  });

  it("preserves the separate development output directory", () => {
    vi.stubEnv("MERCHVISION_CPANEL_BUILD", "1");
    expect(nextConfig(PHASE_DEVELOPMENT_SERVER).distDir).toBe(".next-dev");
  });
});
