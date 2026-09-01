const FACTORS = [
  "recentPositiveSpreadRatio",
  "dailyPositiveSpreadRatio",
  "dailySampleCoverage",
  "freshnessFactor",
  "stabilityFactor"
] as const;

type FactorName = typeof FACTORS[number];
type FactorWeights = Record<FactorName, number>;

export type CalibrationAnalysisRow = {
  bucketAt: Date;
  itemId: number;
  modelVersion: string;
  features: unknown;
  proxyGpPerHour: number | null;
};

export type WeightRecommendation = {
  trainingBucketCount: number;
  validationBucketCount: number;
  selectedWeights: FactorWeights;
  trainingAverageZeroInclusiveProxyGpPerHour: number;
  validationAverageZeroInclusiveProxyGpPerHour: number;
  equalWeightValidationAverageZeroInclusiveProxyGpPerHour: number;
};

export function recommendMonotonicConfidenceWeights(
  rows: CalibrationAnalysisRow[]
): WeightRecommendation | null {
  const parsed = rows.flatMap((row) => {
    const features = parseFeatures(row.features);
    return features ? [{ ...row, ...features }] : [];
  });
  const buckets = [...new Set(parsed.map((row) => row.bucketAt.getTime()))].sort((a, b) => a - b);
  if (buckets.length < 4) return null;

  const splitIndex = Math.max(1, Math.floor(buckets.length * 0.7));
  const trainingBuckets = new Set(buckets.slice(0, splitIndex));
  const validationBuckets = new Set(buckets.slice(splitIndex));
  const training = parsed.filter((row) => trainingBuckets.has(row.bucketAt.getTime()));
  const validation = parsed.filter((row) => validationBuckets.has(row.bucketAt.getTime()));
  const candidates = candidateWeights();
  const selected = candidates.reduce((best, weights) => {
    const objective = rankingObjective(training, weights);
    return objective > best.objective ? { weights, objective } : best;
  }, { weights: candidates[0], objective: Number.NEGATIVE_INFINITY });
  const equalWeights = normalizedWeights([1, 1, 1, 1, 1]);

  return {
    trainingBucketCount: trainingBuckets.size,
    validationBucketCount: validationBuckets.size,
    selectedWeights: selected.weights,
    trainingAverageZeroInclusiveProxyGpPerHour: roundMetric(selected.objective),
    validationAverageZeroInclusiveProxyGpPerHour: roundMetric(rankingObjective(validation, selected.weights)),
    equalWeightValidationAverageZeroInclusiveProxyGpPerHour: roundMetric(
      rankingObjective(validation, equalWeights)
    )
  };
}

function rankingObjective(
  rows: Array<CalibrationAnalysisRow & ParsedFeatures>,
  weights: FactorWeights
): number {
  if (rows.length === 0) return 0;
  const byBucket = new Map<number, Array<CalibrationAnalysisRow & ParsedFeatures>>();
  for (const row of rows) {
    const bucket = row.bucketAt.getTime();
    byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), row]);
  }
  const selected = [...byBucket.values()].flatMap((bucketRows) =>
    bucketRows
      .sort((a, b) => calibratedGpPerHour(b, weights) - calibratedGpPerHour(a, weights) || a.itemId - b.itemId)
      .slice(0, 25)
  );
  return selected.reduce((total, row) => total + (row.proxyGpPerHour ?? 0), 0) / selected.length;
}

function calibratedGpPerHour(row: ParsedFeatures, weights: FactorWeights): number {
  const confidence = Math.exp(FACTORS.reduce(
    (total, factor) => total + weights[factor] * Math.log(Math.max(row.factors[factor], 0.0001)),
    0
  ));
  return row.baseEstimatedGpPerHour * confidence;
}

type ParsedFeatures = {
  baseEstimatedGpPerHour: number;
  factors: Record<FactorName, number>;
};

function parseFeatures(value: unknown): ParsedFeatures | undefined {
  if (!isRecord(value) || !isRecord(value.analysis)) return undefined;
  const analysis = value.analysis;
  const baseEstimatedGpPerHour = finiteNumber(analysis.baseEstimatedGpPerHour);
  const factors = Object.fromEntries(FACTORS.map((factor) => [factor, finiteNumber(analysis[factor])])) as Record<FactorName, number | undefined>;
  if (baseEstimatedGpPerHour === undefined || FACTORS.some((factor) => factors[factor] === undefined)) return undefined;
  return {
    baseEstimatedGpPerHour,
    factors: factors as Record<FactorName, number>
  };
}

function candidateWeights(): FactorWeights[] {
  const candidates: FactorWeights[] = [normalizedWeights([1, 1, 1, 1, 1])];
  for (let mask = 1; mask < 2 ** FACTORS.length; mask += 1) {
    candidates.push(normalizedWeights(FACTORS.map((_, index) => mask & (1 << index) ? 2 : 1)));
  }
  return candidates;
}

function normalizedWeights(values: number[]): FactorWeights {
  const total = values.reduce((sum, value) => sum + value, 0);
  return Object.fromEntries(FACTORS.map((factor, index) => [factor, values[index] / total])) as FactorWeights;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function roundMetric(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
