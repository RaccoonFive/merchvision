import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

function expectPngSize(file: string, width: number, height: number) {
  const png = readFileSync(file);
  expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(png.toString("ascii", 12, 16)).toBe("IHDR");
  expect(png.readUInt32BE(16)).toBe(width);
  expect(png.readUInt32BE(20)).toBe(height);
}

describe("app installation", () => {
  it("keeps a stable app identity and launches a public tool in a standalone window", () => {
    const app = manifest();

    expect(app.id).toBe("/");
    expect(app.name).toBe("Merchvision");
    expect(app.short_name).toBe("Merchvision");
    expect(app.display).toBe("standalone");
    expect(app.scope).toBe("/");
    expect(app.start_url).toBe("/flips");
    expect(existsSync(path.join(process.cwd(), "app", app.start_url!, "page.tsx"))).toBe(true);
  });

  it("provides real PNG assets at the declared install and Apple home-screen sizes", () => {
    const icons = manifest().icons!;

    expect(icons.map((icon) => icon.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    for (const icon of icons) {
      expect(icon.type).toBe("image/png");
      const [width, height] = icon.sizes!.split("x").map(Number);
      expectPngSize(path.join(process.cwd(), "public", icon.src), width, height);
    }
    expectPngSize(path.join(process.cwd(), "app/apple-icon.png"), 180, 180);
  });
});
