import { calculateGeTax } from "./tax";
import type { ItemQuote, LatestPrice } from "./types";

export function buildItemQuote(price?: LatestPrice, nowSeconds = Math.floor(Date.now() / 1000)): ItemQuote {
  const high = positiveValue(price?.high);
  const low = positiveValue(price?.low);
  const highTime = positiveValue(price?.highTime);
  const lowTime = positiveValue(price?.lowTime);
  const timestamps = [highTime, lowTime].filter((value): value is number => value !== null);
  const freshnessSeconds = timestamps.length > 0 ? Math.max(0, nowSeconds - Math.max(...timestamps)) : null;

  if (high === null || low === null) {
    return {
      high,
      low,
      highTime,
      lowTime,
      margin: null,
      tax: null,
      netProfit: null,
      roi: null,
      freshnessSeconds
    };
  }

  const margin = high - low;
  const tax = calculateGeTax(high);
  const netProfit = margin - tax;

  return {
    high,
    low,
    highTime,
    lowTime,
    margin,
    tax,
    netProfit,
    roi: netProfit / low,
    freshnessSeconds
  };
}

export function buildItemQuoteWarnings(quote: ItemQuote): string[] {
  const warnings: string[] = [];
  if (quote.high === null || quote.low === null) warnings.push("This item does not currently have both a high and low quote, so its margin is unavailable.");
  if (quote.netProfit !== null && quote.netProfit < 0) warnings.push("The latest quotes produce a negative margin after GE tax.");
  if (quote.freshnessSeconds !== null && quote.freshnessSeconds > 60 * 60) warnings.push("The freshest quote is over one hour old and may not reflect the current market.");
  return warnings;
}

function positiveValue(value?: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}
