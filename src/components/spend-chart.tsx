"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "var(--provider-anthropic)",
  openai: "var(--provider-openai)",
  google: "var(--provider-google)",
  kimi: "var(--provider-kimi)",
};

interface ChartDataPoint {
  date: string;
  [provider: string]: string | number;
}

interface SpendChartProps {
  data: ChartDataPoint[];
}

interface TooltipPayloadEntry {
  dataKey?: string | number;
  value?: number;
  color?: string;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadEntry[]; label?: string }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 shadow-lg">
      <p className="mb-2 text-sm font-medium text-muted-foreground">{label}</p>
      {payload.map((entry) => (
        <div key={String(entry.dataKey)} className="flex items-center justify-between gap-4">
          <span className="text-sm" style={{ color: entry.color }}>
            {String(entry.dataKey)}
          </span>
          <span className="text-sm font-mono">{formatCurrency(entry.value as number)}</span>
        </div>
      ))}
    </div>
  );
}

export function SpendChart({ data }: SpendChartProps) {
  // Extract provider names from data (all keys except "date")
  const providers = data.length > 0
    ? Object.keys(data[0]).filter((k) => k !== "date")
    : [];

  return (
    <Card className="bg-[var(--card)] border-[var(--border)]">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          30-Day Spend
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#a1a1aa", fontSize: 12 }}
              tickFormatter={(v: string) => v.slice(5)} // "03-10"
            />
            <YAxis
              tick={{ fill: "#a1a1aa", fontSize: 12 }}
              tickFormatter={(v: number) => `$${v}`}
            />
            <Tooltip content={<CustomTooltip />} />
            {providers.map((provider) => (
              <Bar
                key={provider}
                dataKey={provider}
                stackId="spend"
                fill={PROVIDER_COLORS[provider] ?? "var(--neon-purple)"}
                radius={provider === providers[providers.length - 1] ? [2, 2, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function SpendChartSkeleton() {
  return (
    <Card className="bg-[var(--card)] border-[var(--border)]">
      <CardHeader>
        <Skeleton className="h-4 w-28 bg-zinc-800" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[300px] w-full bg-zinc-800" />
      </CardContent>
    </Card>
  );
}
