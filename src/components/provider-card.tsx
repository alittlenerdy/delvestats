import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatTokens } from "@/lib/format";

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "var(--provider-anthropic)",
  openai: "var(--provider-openai)",
  google: "var(--provider-google)",
  kimi: "var(--provider-kimi)",
};

interface ProviderCardProps {
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
}

export function ProviderCard({ name, totalCost, models, lastPollStatus }: ProviderCardProps) {
  const borderColor = PROVIDER_COLORS[name] ?? "var(--neon-purple)";

  return (
    <Card
      className="bg-[var(--card)] border-[var(--border)]"
      style={{ borderLeftWidth: "4px", borderLeftColor: borderColor }}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold capitalize">{name}</span>
          <Badge
            variant="outline"
            className={`h-5 text-xs ${
              lastPollStatus === "ok"
                ? "border-[var(--neon-green)] text-[var(--neon-green)]"
                : "border-[var(--neon-pink)] text-[var(--neon-pink)]"
            }`}
          >
            {lastPollStatus === "ok" ? "healthy" : "error"}
          </Badge>
        </div>
        <span className="text-lg font-mono font-bold text-[var(--neon-green)]">
          {formatCurrency(totalCost)}
        </span>
      </CardHeader>
      <CardContent>
        {models.length === 0 ? (
          <p className="text-sm text-zinc-500">No data yet</p>
        ) : (
          <div className="space-y-2">
            {models.map((m) => (
              <div key={m.model} className="flex items-center justify-between text-sm">
                <span className="font-mono text-muted-foreground truncate max-w-[180px]">
                  {m.model}
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[var(--neon-purple)]">
                    {formatTokens(m.inputTokens)} / {formatTokens(m.outputTokens)}
                  </span>
                  <span className="font-mono text-[var(--neon-green)]">
                    {formatCurrency(m.cost)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
