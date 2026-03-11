import { ProviderCard } from "./provider-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

interface ProviderData {
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

interface ProviderGridProps {
  providers: ProviderData[];
}

export function ProviderGrid({ providers }: ProviderGridProps) {
  if (providers.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {providers.map((provider) => (
        <ProviderCard key={provider.name} {...provider} />
      ))}
    </div>
  );
}

export function ProviderGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {[1, 2].map((i) => (
        <Card key={i} className="bg-[var(--card)] border-[var(--border)] p-6">
          <Skeleton className="h-6 w-24 bg-zinc-800 mb-4" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full bg-zinc-800" />
            <Skeleton className="h-4 w-3/4 bg-zinc-800" />
          </div>
        </Card>
      ))}
    </div>
  );
}
