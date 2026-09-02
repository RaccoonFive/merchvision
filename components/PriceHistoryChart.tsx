"use client";

import type { ComponentProps } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { formatCompact, formatGp } from "@/lib/format";

export type PriceHistoryChartPoint = {
  time: string;
  high?: number | null;
  low?: number | null;
  midpoint?: number | null;
};

export type PriceHistoryChartColors = {
  grid: string;
  axis: string;
  tooltip: string;
  high?: string;
  low?: string;
  trend?: string;
};

type PriceHistoryChartProps = {
  colors: PriceHistoryChartColors;
  data: PriceHistoryChartPoint[];
  domain?: ComponentProps<typeof YAxis>["domain"];
  minTickGap?: number;
  series: "high-low" | "midpoint";
};

export default function PriceHistoryChart({
  colors,
  data,
  domain,
  minTickGap,
  series
}: PriceHistoryChartProps) {
  return (
    <ResponsiveContainer height="100%" width="100%">
      <AreaChart data={data}>
        <CartesianGrid stroke={colors.grid} vertical={false} />
        <XAxis dataKey="time" minTickGap={minTickGap} stroke={colors.axis} tick={{ fontSize: 11 }} />
        <YAxis
          domain={domain}
          stroke={colors.axis}
          tick={{ fontSize: 11 }}
          tickFormatter={formatCompact}
          width={72}
        />
        <Tooltip
          contentStyle={{ background: colors.tooltip, border: 0, borderRadius: 8, color: colors.axis }}
          formatter={(value) => formatGp(Number(value))}
        />
        {series === "high-low" ? (
          <>
            <Area dataKey="high" fill={`${colors.high ?? colors.axis}26`} name="High" stroke={colors.high ?? colors.axis} />
            <Area dataKey="low" fill={`${colors.low ?? colors.axis}26`} name="Low" stroke={colors.low ?? colors.axis} />
          </>
        ) : (
          <Area
            dataKey="midpoint"
            fill={`${colors.trend ?? colors.axis}26`}
            name="Midpoint"
            stroke={colors.trend ?? colors.axis}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}
