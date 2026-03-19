import { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { db } from "@/db/client";
import { getConfiguredProviders } from "@/providers/registry";
import { insertUsageRecordsIgnoreDuplicates, logPoll } from "@/db/queries";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const days = Math.min(body.days ?? 30, 90);

  const providers = getConfiguredProviders();
  const results: Array<{ provider: string; status: string; records?: number; error?: string }> = [];

  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

  for (const provider of providers) {
    try {
      // Fetch in daily chunks to avoid API pagination limits
      let totalRecords = 0;
      const chunkMs = 24 * 60 * 60 * 1000;
      let chunkStart = new Date(startDate);

      while (chunkStart < endDate) {
        const chunkEnd = new Date(Math.min(chunkStart.getTime() + chunkMs, endDate.getTime()));
        const records = await provider.fetchUsage(chunkStart, chunkEnd);

        if (records.length > 0) {
          const inserted = await insertUsageRecordsIgnoreDuplicates(
            db,
            records.map((r) => ({
              ...r,
              recordedAt: new Date().toISOString(),
            }))
          );
          totalRecords += inserted ?? 0;
        }

        chunkStart = chunkEnd;
      }

      await logPoll(db, provider.name, "ok");
      results.push({ provider: provider.name, status: "ok", records: totalRecords });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      await logPoll(db, provider.name, "error", msg);
      results.push({ provider: provider.name, status: "error", error: msg });
    }
  }

  return Response.json({ results, days, startDate: startDate.toISOString(), endDate: endDate.toISOString() });
}
