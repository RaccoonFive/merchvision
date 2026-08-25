const wholeNumberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const compactNumberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1
});

export function formatNumber(value: number): string {
  return wholeNumberFormatter.format(value);
}

export function formatGp(value: number): string {
  return `${formatNumber(value)} gp`;
}

export function formatNullableGp(value: number | null): string {
  return value === null ? "Unavailable" : formatGp(value);
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function formatCompact(value: number): string {
  return compactNumberFormatter.format(value);
}

export function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatTimestamp(timestamp: number | null): string {
  return timestamp === null ? "No trade timestamp" : new Date(timestamp * 1000).toLocaleString();
}
