import { env } from "@/lib/env";
import { db } from "@/db/client";
import { insertUsageRecordsIgnoreDuplicates } from "@/db/queries";

export const dynamic = "force-dynamic";

const PROJECT_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]?$/;
const MAX_BATCH_SIZE = 100;

interface IngestRecord {
  project?: string | null;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  requestId?: string;
}

const validateRecord = (r: unknown): r is IngestRecord => {
  if (typeof r !== "object" || r === null) return false;
  const rec = r as Record<string, unknown>;
  return (
    typeof rec.provider === "string" &&
    typeof rec.model === "string" &&
    typeof rec.inputTokens === "number" &&
    typeof rec.outputTokens === "number" &&
    typeof rec.costUsd === "number"
  );
};

const validateProject = (project: unknown): boolean => {
  if (project === undefined || project === null) return true;
  if (typeof project !== "string") return false;
  return PROJECT_PATTERN.test(project) && project.length <= 64;
};

export const POST = async (request: Request) => {
  if (!env.ingestApiKey) {
    return Response.json({ error: "INGEST_API_KEY not configured" }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.ingestApiKey}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;
  const recordsRaw: unknown[] = Array.isArray(raw.records) ? raw.records : [raw];

  if (recordsRaw.length > MAX_BATCH_SIZE) {
    return Response.json(
      { error: `Batch size ${recordsRaw.length} exceeds max of ${MAX_BATCH_SIZE}` },
      { status: 400 }
    );
  }

  for (const r of recordsRaw) {
    if (!validateRecord(r)) {
      return Response.json(
        { error: "Each record requires: provider, model, inputTokens, outputTokens, costUsd" },
        { status: 400 }
      );
    }
    if (!validateProject((r as IngestRecord).project)) {
      return Response.json(
        { error: "project must be lowercase alphanumeric with hyphens, max 64 chars" },
        { status: 400 }
      );
    }
  }

  const records = recordsRaw as IngestRecord[];
  const now = new Date().toISOString();

  const dbRecords = records.map((r) => ({
    provider: r.provider,
    model: r.model,
    project: r.project ?? null,
    requestId: r.requestId ?? null,
    inputTokens: r.inputTokens,
    outputTokens: r.outputTokens,
    costUsd: r.costUsd,
    recordedAt: now,
    periodStart: now,
    periodEnd: now,
  }));

  const inserted = await insertUsageRecordsIgnoreDuplicates(db, dbRecords);

  return Response.json({ inserted: inserted ?? dbRecords.length }, { status: 201 });
};
