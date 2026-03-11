"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatTokens, formatTrend } from "@/lib/format";
import { ArrowUpRight, ArrowDownRight, ArrowUpDown } from "lucide-react";

interface UsageRow {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  trend: number;
}

type SortKey = "provider" | "model" | "inputTokens" | "outputTokens" | "cost" | "trend";
type SortDir = "asc" | "desc";

interface UsageTableProps {
  data: UsageRow[];
}

export function UsageTable({ data }: UsageTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("cost");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [providerFilter, setProviderFilter] = useState<string>("all");

  const providers = Array.from(new Set(data.map((r) => r.provider)));

  const filtered = providerFilter === "all"
    ? data
    : data.filter((r) => r.provider === providerFilter);

  const sorted = [...filtered].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    const cmp = typeof aVal === "string" ? aVal.localeCompare(bVal as string) : (aVal as number) - (bVal as number);
    return sortDir === "asc" ? cmp : -cmp;
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const columns: { key: SortKey; label: string; align?: string }[] = [
    { key: "provider", label: "Provider" },
    { key: "model", label: "Model" },
    { key: "inputTokens", label: "In Tokens", align: "right" },
    { key: "outputTokens", label: "Out Tokens", align: "right" },
    { key: "cost", label: "Cost", align: "right" },
    { key: "trend", label: "Trend", align: "right" },
  ];

  return (
    <Card className="bg-[var(--card)] border-[var(--border)]">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Usage Breakdown
        </CardTitle>
        <select
          value={providerFilter}
          onChange={(e) => setProviderFilter(e.target.value)}
          className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm text-foreground"
        >
          <option value="all">All Providers</option>
          {providers.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-[var(--border)] hover:bg-transparent">
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={`cursor-pointer select-none ${col.align === "right" ? "text-right" : ""}`}
                  onClick={() => toggleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key && (
                      <ArrowUpDown className="h-3 w-3 text-[var(--neon-yellow)]" />
                    )}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row, i) => (
              <TableRow
                key={`${row.provider}-${row.model}`}
                className={`border-[var(--border)] ${i % 2 === 0 ? "bg-[var(--background)]" : "bg-[var(--card)]"}`}
              >
                <TableCell className="capitalize">{row.provider}</TableCell>
                <TableCell className="font-mono text-muted-foreground">{row.model}</TableCell>
                <TableCell className="text-right font-mono text-[var(--neon-purple)]">
                  {formatTokens(row.inputTokens)}
                </TableCell>
                <TableCell className="text-right font-mono text-[var(--neon-purple)]">
                  {formatTokens(row.outputTokens)}
                </TableCell>
                <TableCell className="text-right font-mono text-[var(--neon-green)]">
                  {formatCurrency(row.cost)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  <span className={`inline-flex items-center gap-1 ${
                    row.trend > 0 ? "text-[var(--neon-pink)]" : row.trend < 0 ? "text-[var(--neon-green)]" : "text-muted-foreground"
                  }`}>
                    {row.trend > 0 && <ArrowUpRight className="h-3 w-3" />}
                    {row.trend < 0 && <ArrowDownRight className="h-3 w-3" />}
                    {formatTrend(row.trend)}
                  </span>
                </TableCell>
              </TableRow>
            ))}
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No usage data available
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function UsageTableSkeleton() {
  return (
    <Card className="bg-[var(--card)] border-[var(--border)]">
      <CardHeader>
        <Skeleton className="h-4 w-32 bg-zinc-800" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-8 w-full bg-zinc-800" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
