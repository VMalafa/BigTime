"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/utils/format";

interface DataPoint {
  month: number;
  balance: number;
}

interface DebtPayoffChartProps {
  data: DataPoint[];
  strategyName: string;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-bg-secondary rounded-lg px-3 py-2 shadow-md">
      <p className="text-text-secondary text-xs font-sans">Month {label}</p>
      <p className="text-text-primary text-sm font-serif font-medium">
        {formatCurrency(payload[0].value)}
      </p>
    </div>
  );
}

export function DebtPayoffChart({ data, strategyName }: DebtPayoffChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 rounded-lg bg-bg-secondary/30">
        <p className="text-text-secondary text-sm font-sans">
          No payoff data to display yet.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-text-secondary text-sm font-sans mb-3">
        Projected payoff &mdash; {strategyName}
      </p>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--bg-secondary)"
            vertical={false}
          />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: "var(--text-secondary)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--bg-secondary)" }}
            label={{
              value: "Month",
              position: "insideBottomRight",
              offset: -4,
              style: { fontSize: 11, fill: "var(--text-secondary)" },
            }}
          />
          <YAxis
            tickFormatter={(v: number) => formatCurrency(v)}
            tick={{ fontSize: 12, fill: "var(--text-secondary)" }}
            tickLine={false}
            axisLine={false}
            width={80}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="balance"
            stroke="#C4A265"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, fill: "#C4A265", stroke: "#fff", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
