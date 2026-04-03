"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/utils/format";

interface ScheduleEntry {
  month: number;
  totalBalance: number;
}

interface AmortizationChartProps {
  schedule: ScheduleEntry[];
  strategyName: string;
}

export function AmortizationChart({
  schedule,
  strategyName,
}: AmortizationChartProps) {
  if (!schedule || schedule.length === 0) {
    return (
      <div className="text-center py-12 text-text-secondary">
        <p>No amortization data to display.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-serif text-lg text-text-primary">
        Balance Over Time{" "}
        <span className="text-accent-gold">({strategyName})</span>
      </h3>

      <div className="w-full h-72 md:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={schedule}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--accent-gold)"
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor="var(--accent-gold)"
                  stopOpacity={0.02}
                />
              </linearGradient>
            </defs>
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
                value: "Months",
                position: "insideBottomRight",
                offset: -5,
                fontSize: 12,
                fill: "var(--text-secondary)",
              }}
            />
            <YAxis
              tickFormatter={(val: number) => formatCurrency(val)}
              tick={{ fontSize: 12, fill: "var(--text-secondary)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--bg-secondary)" }}
              width={80}
            />
            <Tooltip
              formatter={(value) => [formatCurrency(Number(value)), "Balance"]}
              labelFormatter={(label) => `Month ${label}`}
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid var(--bg-secondary)",
                borderRadius: "8px",
                fontSize: "13px",
              }}
            />
            <Area
              type="monotone"
              dataKey="totalBalance"
              stroke="var(--accent-gold)"
              strokeWidth={2}
              fill="url(#goldGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
