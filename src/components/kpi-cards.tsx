import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";

interface KpiCardsProps {
  today: number;
  week: number;
  month: number;
}

const kpiItems = [
  { key: "today" as const, label: "Today" },
  { key: "week" as const, label: "This Week" },
  { key: "month" as const, label: "This Month" },
];

export function KpiCards({ today, week, month }: KpiCardsProps) {
  const values = { today, week, month };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {kpiItems.map((item) => (
        <Card
          key={item.key}
          className="bg-[var(--card)] border-[var(--border)] shadow-[0_0_20px_rgba(57,255,20,0.15)]"
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {item.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-mono font-bold text-[var(--neon-green)]">
              {formatCurrency(values[item.key])}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function KpiCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="bg-[var(--card)] border-[var(--border)]">
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-20 bg-zinc-800" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-9 w-32 bg-zinc-800" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
