import { describe, expect, it } from "vitest";
import { recommendMonotonicConfidenceWeights } from "./flipCalibrationAnalysis";

describe("recommendMonotonicConfidenceWeights", () => {
  it("chooses weights on earlier buckets and reports performance on later buckets", () => {
    const rows = Array.from({ length: 10 }, (_, bucket) => [
      row(bucket, 1, 10_000, { recentPositiveSpreadRatio: 1, stabilityFactor: 0.3 }),
      row(bucket, 2, 1_000, { recentPositiveSpreadRatio: 0.3, stabilityFactor: 1 })
    ]).flat();

    const recommendation = recommendMonotonicConfidenceWeights(rows);

    expect(recommendation).toMatchObject({
      trainingBucketCount: 7,
      validationBucketCount: 3,
      trainingAverageZeroInclusiveProxyGpPerHour: 5_500,
      validationAverageZeroInclusiveProxyGpPerHour: 5_500
    });
    expect(Object.values(recommendation!.selectedWeights).every((weight) => weight > 0)).toBe(true);
    expect(Object.values(recommendation!.selectedWeights).reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1);
  });

  it("waits for enough time buckets before recommending coefficients", () => {
    expect(recommendMonotonicConfidenceWeights([row(0, 1, 1_000, {})])).toBeNull();
  });
});

function row(
  bucket: number,
  itemId: number,
  proxyGpPerHour: number,
  overrides: Partial<Record<"recentPositiveSpreadRatio" | "stabilityFactor", number>>
) {
  return {
    bucketAt: new Date(Date.UTC(2026, 8, 1, bucket)),
    itemId,
    modelVersion: "upside-v1",
    proxyGpPerHour,
    features: {
      analysis: {
        baseEstimatedGpPerHour: 10_000,
        recentPositiveSpreadRatio: overrides.recentPositiveSpreadRatio ?? 1,
        dailyPositiveSpreadRatio: 1,
        dailySampleCoverage: 1,
        freshnessFactor: 1,
        stabilityFactor: overrides.stabilityFactor ?? 1
      }
    }
  };
}
