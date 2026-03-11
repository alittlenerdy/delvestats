"use client";

import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/format";
import { RefreshCw } from "lucide-react";

interface TopBarProps {
  lastPolledAt: string;
  onRefresh: () => void;
  isLoading: boolean;
}

export function TopBar({ lastPolledAt, onRefresh, isLoading }: TopBarProps) {
  return (
    <header className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
      <div className="flex items-center gap-2">
        <span className="text-xl font-bold tracking-tight">
          <span className="text-[var(--neon-green)]">Delve</span>Stats
        </span>
      </div>
      <div className="flex items-center gap-4">
        {lastPolledAt && (
          <span className="text-sm text-muted-foreground font-mono">
            Last polled: {timeAgo(lastPolledAt)}
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
}
