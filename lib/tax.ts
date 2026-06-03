import type { TaxConfig } from "./types";

export const DEFAULT_TAX_CONFIG: TaxConfig = {
  rate: 0.02,
  cap: 5_000_000
};

export function calculateGeTax(sellPrice: number, config = DEFAULT_TAX_CONFIG): number {
  if (!Number.isFinite(sellPrice) || sellPrice <= 0) {
    return 0;
  }

  return Math.min(Math.floor(sellPrice * config.rate), config.cap);
}
