import type { FlipDataHealth } from "./flipFinder";
import { formatClock } from "./format";

export function flipDataHealthMessage(health: FlipDataHealth): string {
  const issues: string[] = [];
  if (!health.summaryAvailable) issues.push("the 24-hour market summary was unavailable");
  if (health.historyFailed > 0) {
    issues.push(`${health.historyFailed} of ${health.historyRequested} item histories failed to load`);
  }
  return `Partial market data: ${issues.join(" and ")}. Rankings use the evidence that is available.`;
}

export function flipStatusLabel({
  dataHealth,
  error,
  flips,
  generatedAt
}: {
  dataHealth: FlipDataHealth | null;
  error: string | null;
  flips: Array<{ freshnessSeconds: number }>;
  generatedAt: string | null;
}): string {
  if (error && flips.length === 0) return "Data unavailable";
  if (!generatedAt) return "Waiting for prices";
  const state = dataHealth?.isPartial
    ? "Partial data"
    : flips.length > 0 && flips.every((flip) => flip.freshnessSeconds > 3_600)
      ? "Stale quotes"
      : "Updated";
  return `${state} ${formatClock(generatedAt)}`;
}
