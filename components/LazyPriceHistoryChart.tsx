"use client";

import dynamic from "next/dynamic";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import type { PriceHistoryChartColors, PriceHistoryChartPoint } from "@/components/PriceHistoryChart";

const PriceHistoryChart = dynamic(() => import("@/components/PriceHistoryChart"), {
  loading: () => <LoadingSpinner label="Loading chart renderer..." />,
  ssr: false
});

type LazyPriceHistoryChartProps = {
  colors: PriceHistoryChartColors;
  data: PriceHistoryChartPoint[];
  domain?: ["auto", "auto"] | [number, number];
  minTickGap?: number;
  series: "high-low" | "midpoint";
};

export function LazyPriceHistoryChart(props: LazyPriceHistoryChartProps) {
  return <PriceHistoryChart {...props} />;
}
