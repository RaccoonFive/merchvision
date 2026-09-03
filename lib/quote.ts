import { calculateGeTax } from "./tax";
import type { ItemQuote, LatestPrice } from "./types";

export function buildItemQuote(price?: LatestPrice, nowSeconds = Math.floor(Date.now() / 1000)): ItemQuote {
  const high = positiveValue(price?.high);
  const low = positiveValue(price?.low);
  const highTime = positiveValue(price?.highTime);
  const lowTime = positiveValue(price?.lowTime);
  const timestamps = [highTime, lowTime].filter((value): value is number => value !== null);
  const freshnessSeconds = timestamps.length > 0 ? Math.max(0, nowSeconds - Math.max(...timestamps)) : null;
  const pairAgeSeconds = highTime !== null && lowTime !== null
    ? Math.max(0, nowSeconds - Math.min(highTime, lowTime))
    : null;
  const quoteSkewSeconds = highTime !== null && lowTime !== null ? Math.abs(highTime - lowTime) : null;

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
      freshnessSeconds,
      pairAgeSeconds,
      quoteSkewSeconds
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
    freshnessSeconds,
    pairAgeSeconds,
    quoteSkewSeconds
  };
}

export function buildItemQuoteWarnings(quote: ItemQuote): string[] {
  const warnings: string[] = [];
  if (quote.high === null || quote.low === null) warnings.push("This item does not currently have both a high and low quote, so its margin is unavailable.");
  if (quote.netProfit !== null && quote.netProfit < 0) warnings.push("The latest quotes produce a negative margin after GE tax.");
  const availableAge = quote.pairAgeSeconds ?? quote.freshnessSeconds;
  if (availableAge !== null && availableAge > 60 * 60) warnings.push("The available quote data is over one hour old and may not reflect the current market.");
  if (quote.quoteSkewSeconds !== null && quote.quoteSkewSeconds > 15 * 60) warnings.push("The high and low trades are over 15 minutes apart, so the observed margin may not be simultaneous.");
  return warnings;
}

function positiveValue(value?: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}
