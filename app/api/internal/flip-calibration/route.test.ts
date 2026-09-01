import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/flipCalibration", () => ({
  getFlipCalibrationReport: vi.fn(),
  runFlipCalibration: vi.fn()
}));

import { getFlipCalibrationReport, runFlipCalibration } from "@/lib/flipCalibration";
import { GET, POST } from "./route";

const mockedReport = vi.mocked(getFlipCalibrationReport);
const mockedRun = vi.mocked(runFlipCalibration);
const originalSecret = process.env.CRON_SECRET;

describe("/api/internal/flip-calibration", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  });

  it("requires configuration and a matching bearer secret", async () => {
    delete process.env.CRON_SECRET;
    expect((await POST(request())).status).toBe(503);

    process.env.CRON_SECRET = "test-cron-secret";
    expect((await POST(request("wrong"))).status).toBe(401);
    expect(mockedRun).not.toHaveBeenCalled();
  });

  it("runs collection and returns reports for authorized requests", async () => {
    mockedRun.mockResolvedValue({ created: 3, resolved: 2, pruned: 1, bucketAt: "2026-09-01T12:00:00.000Z" });
    mockedReport.mockResolvedValue({
      generatedAt: "2026-09-01T12:00:00.000Z",
      retentionDays: 90,
      resolvedCount: 10,
      oldestObservedAt: null,
      readyForReview: false,
      models: [],
      upsideWeightRecommendation: null
    });

    const post = await POST(request("test-cron-secret"));
    const get = await GET(request("test-cron-secret"));

    expect(post.status).toBe(200);
    expect(await post.json()).toMatchObject({ data: { created: 3, resolved: 2 } });
    expect(get.status).toBe(200);
    expect(await get.json()).toMatchObject({ data: { retentionDays: 90, resolvedCount: 10 } });
  });

  it("returns safe errors when calibration work fails", async () => {
    mockedRun.mockRejectedValue(new Error("database details"));
    const response = await POST(request("test-cron-secret"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Unable to run flip calibration." });
  });
});

function request(secret?: string): Request {
  return new Request("http://localhost/api/internal/flip-calibration", {
    method: "POST",
    headers: secret ? { authorization: `Bearer ${secret}` } : undefined
  });
}
