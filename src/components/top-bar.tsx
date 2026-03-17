"use client";

import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/format";
import { RefreshCw } from "lucide-react";

interface TopBarProps {
  lastDataAt: string;
  projects: string[];
  selectedProject: string | null;
  onProjectChange: (project: string | null) => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const TopBar = ({ lastDataAt, projects, selectedProject, onProjectChange, onRefresh, isLoading }: TopBarProps) => {
  return (
    <header className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
      <div className="flex items-center gap-4">
        <span className="text-xl font-bold tracking-tight">
          <span className="text-[var(--neon-green)]">Delve</span>Stats
        </span>
        {projects.length > 0 && (
          <select
            value={selectedProject ?? ""}
            onChange={(e) => onProjectChange(e.target.value || null)}
            className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-[var(--neon-green)]"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        )}
      </div>
      <div className="flex items-center gap-4">
        {lastDataAt && (
          <span className="text-sm text-muted-foreground font-mono">
            Last data: {timeAgo(lastDataAt)}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onRefresh}
          disabled={isLoading}
          className="hover:text-[var(--neon-yellow)] hover:shadow-[0_0_12px_rgba(255,214,10,0.3)] transition-all"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>
    </header>
  );
};
