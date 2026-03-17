"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { TopBar } from "./top-bar";
import { KpiCards, KpiCardsSkeleton } from "./kpi-cards";
import { SpendChart, SpendChartSkeleton } from "./spend-chart";
import { ProviderGrid, ProviderGridSkeleton } from "./provider-grid";
import { UsageTable, UsageTableSkeleton } from "./usage-table";

interface DashboardData {
  kpi: { today: number; week: number; month: number };
  chart: Array<{ date: string; [provider: string]: string | number }>;
  providers: Array<{
    name: string;
    totalCost: number;
    models: Array<{
      model: string;
      inputTokens: number;
      outputTokens: number;
      cost: number;
    }>;
    lastPollStatus: "ok" | "error";
    lastPollAt: string;
  }>;
  table: Array<{
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    trend: number;
  }>;
  lastPolledAt: string;
  lastDataAt: string;
  projects: string[];
}

export const DashboardShell = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedProject = searchParams.get("project");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = selectedProject ? `?project=${selectedProject}` : "";
      const res = await fetch(`/api/dashboard${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, [selectedProject]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleProjectChange = (project: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (project) {
      params.set("project", project);
    } else {
      params.delete("project");
    }
    router.push(`?${params.toString()}`);
  };

  const hasData = data && (data.providers.length > 0 || data.kpi.month > 0);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <TopBar
        lastDataAt={data?.lastDataAt ?? ""}
        projects={data?.projects ?? []}
        selectedProject={selectedProject}
        onProjectChange={handleProjectChange}
        onRefresh={fetchData}
        isLoading={isLoading}
      />

      <main className="mx-auto max-w-7xl space-y-6 p-6">
        {error && (
          <div className="rounded-lg border border-[var(--neon-pink)] bg-[var(--card)] p-4 text-sm">
            <span className="text-[var(--neon-pink)]">Failed to load data.</span>{" "}
            <button
              onClick={fetchData}
              className="underline text-[var(--neon-yellow)] hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {!hasData && !isLoading && !error && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-12 text-center">
            <p className="text-lg text-muted-foreground">
              No usage data yet. Set up the reporting middleware in your projects to start tracking.
            </p>
          </div>
        )}

        {isLoading && !data ? (
          <>
            <KpiCardsSkeleton />
            <SpendChartSkeleton />
            <ProviderGridSkeleton />
            <UsageTableSkeleton />
          </>
        ) : data ? (
          <>
            <KpiCards today={data.kpi.today} week={data.kpi.week} month={data.kpi.month} />
            <SpendChart data={data.chart} />
            <ProviderGrid providers={data.providers} />
            <UsageTable data={data.table} />
          </>
        ) : null}
      </main>
    </div>
  );
};
