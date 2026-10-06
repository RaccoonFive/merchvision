import { buildQuoteHealth } from "./scoring";
import type { FlipCandidate } from "./types";

export const SESSION_LENGTHS = [30, 60, 120, 240] as const;
export const CHECK_INTERVALS = [5, 15, 30, 60] as const;
export const MAX_SESSION_BUDGET = 1_000_000_000_000;

export type SessionInputs = {
  budget: number;
  slots: number;
  sessionMinutes: number;
  checkIntervalMinutes: number;
  members: "all" | "f2p";
};

export type SessionAllocation = {
  candidate: FlipCandidate;
  quantity: number;
  capital: number;
  netProfitPerUnit: number;
  estimatedBatchProfit: number;
  capacityUnits: number;
  limitingFactor: "Market capacity" | "Buy limit" | "Capital cap";
};

export type SessionPlan = {
  inputs: SessionInputs;
  allocations: SessionAllocation[];
  allocatedCapital: number;
  unallocatedCapital: number;
  reserve: number;
  perItemCapitalCap: number;
  estimatedBatchProfit: number;
  eligibleCount: number;
  capacityFactor: number;
};

export function validateSessionInputs(input: SessionInputs): string | null {
  if (!Number.isSafeInteger(input.budget) || input.budget < 1 || input.budget > MAX_SESSION_BUDGET) {
    return "Enter a whole-GP budget from 1 to 1,000,000,000,000.";
  }
  if (!Number.isInteger(input.slots) || input.slots < 1 || input.slots > 8) return "Choose 1 to 8 available GE slots.";
  if (!SESSION_LENGTHS.some((minutes) => minutes === input.sessionMinutes)) return "Choose a supported session length.";
  if (!CHECK_INTERVALS.some((minutes) => minutes === input.checkIntervalMinutes)) return "Choose a supported checking interval.";
  if (input.members !== "all" && input.members !== "f2p") return "Choose a supported account type.";
  return null;
}

export function buildSessionPlan(candidates: FlipCandidate[], inputs: SessionInputs, nowSeconds: number): SessionPlan {
  const error = validateSessionInputs(inputs);
  if (error) throw new Error(error);
  if (!Number.isFinite(nowSeconds)) throw new Error("Market evaluation time is unavailable.");

  const reserve = Math.ceil(inputs.budget / 5);
  const spendable = inputs.budget - reserve;
  const perItemCapitalCap = Math.min(Math.floor(inputs.budget / 4), Math.floor(spendable / inputs.slots));
  // One batch, with half the session allowed for each leg. Infrequent checks
  // reduce exposure; this is a fixed safety haircut, not a measured fill rate.
  const capacityFactor = Math.min(1, 15 / inputs.checkIntervalMinutes);
  const capacityHours = inputs.sessionMinutes / 120 * capacityFactor;
  const seen = new Set<number>();
  const eligible = [...candidates]
    .filter((candidate) => eligibleForSession(candidate, inputs, nowSeconds))
    .sort((a, b) => b.score - a.score || a.id - b.id)
    .filter((candidate) => {
      if (seen.has(candidate.id)) return false;
      seen.add(candidate.id);
      return true;
    });

  const allocations: SessionAllocation[] = [];
  for (const candidate of eligible) {
    if (allocations.length >= inputs.slots) break;
    const capacityUnits = Math.floor(candidate.marketAnalysis!.estimatedExecutableUnitsPerHour * capacityHours);
    const limits = [
      { quantity: capacityUnits, label: "Market capacity" as const },
      { quantity: candidate.buyLimit!, label: "Buy limit" as const },
      { quantity: Math.floor(perItemCapitalCap / candidate.buyPrice), label: "Capital cap" as const }
    ];
    const limiting = limits.reduce((minimum, limit) => limit.quantity < minimum.quantity ? limit : minimum);
    if (limiting.quantity < 1) continue;
    const netProfitPerUnit = Math.min(candidate.netProfit, candidate.repeatableNetProfit!);
    allocations.push({
      candidate,
      quantity: limiting.quantity,
      capital: limiting.quantity * candidate.buyPrice,
      netProfitPerUnit,
      estimatedBatchProfit: limiting.quantity * netProfitPerUnit,
      capacityUnits,
      limitingFactor: limiting.label
    });
  }

  const allocatedCapital = allocations.reduce((total, allocation) => total + allocation.capital, 0);
  return {
    inputs: { ...inputs }, allocations, allocatedCapital,
    unallocatedCapital: inputs.budget - allocatedCapital,
    reserve, perItemCapitalCap, capacityFactor, eligibleCount: eligible.length,
    estimatedBatchProfit: allocations.reduce((total, allocation) => total + allocation.estimatedBatchProfit, 0)
  };
}

function eligibleForSession(candidate: FlipCandidate, inputs: SessionInputs, nowSeconds: number): boolean {
  const market = candidate.marketAnalysis;
  const finitePositive = (value: number | null | undefined): value is number =>
    typeof value === "number" && Number.isFinite(value) && value > 0;
  if (candidate.view !== "reliable" || !market || (inputs.members === "f2p" && candidate.members)) return false;
  if (![candidate.buyPrice, candidate.sellPrice, candidate.netProfit, candidate.repeatableNetProfit,
    candidate.highTime, candidate.lowTime, market.estimatedExecutableUnitsPerHour].every(finitePositive)) return false;
  if (!Number.isSafeInteger(candidate.buyLimit) || candidate.buyLimit! < 1) return false;
  if (candidate.highTime > nowSeconds || candidate.lowTime > nowSeconds) return false;
  const quote = buildQuoteHealth(candidate.highTime, candidate.lowTime, nowSeconds);
  return quote.pairAgeSeconds <= 900 && quote.skewSeconds <= 900
    && Number.isFinite(candidate.score) && candidate.score > 0
    && Number.isFinite(candidate.confidence) && candidate.confidence >= 0.6 && candidate.confidence <= 1
    && Number.isFinite(candidate.stability) && candidate.stability >= 0.6 && candidate.stability <= 1
    && Number.isFinite(market.sampleCoverage) && market.sampleCoverage >= 0.5
    && Number.isFinite(market.positiveSpreadRatio) && market.positiveSpreadRatio >= 0.8;
}
