import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInsertUsageRecordsIgnoreDuplicates = vi.fn().mockResolvedValue(undefined);

vi.mock("@/db/queries", () => ({
  insertUsageRecordsIgnoreDuplicates: (...args: unknown[]) => mockInsertUsageRecordsIgnoreDuplicates(...args),
}));

vi.mock("@/db/client", () => ({
  db: {},
}));

vi.mock("@/lib/env", () => ({
  env: {
    ingestApiKey: "test-ingest-key",
  },
}));

import { POST } from "@/app/api/ingest/route";

const makeRequest = (body: unknown, token?: string) => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return new Request("http://localhost/api/ingest", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
};

describe("POST /api/ingest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertUsageRecordsIgnoreDuplicates.mockResolvedValue(undefined);
  });

  it("returns 401 without auth header", async () => {
    const res = await POST(makeRequest({ provider: "anthropic", model: "claude-sonnet-4", inputTokens: 100, outputTokens: 50, costUsd: 0.01 }));
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong token", async () => {
    const res = await POST(makeRequest({ provider: "anthropic", model: "claude-sonnet-4", inputTokens: 100, outputTokens: 50, costUsd: 0.01 }, "wrong-key"));
    expect(res.status).toBe(401);
  });

  it("inserts a single record", async () => {
    const body = {
      project: "replysequence",
      provider: "anthropic",
      model: "claude-sonnet-4",
      inputTokens: 1523,
      outputTokens: 412,
      costUsd: 0.0089,
      requestId: "abc-123",
    };
    const res = await POST(makeRequest(body, "test-ingest-key"));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.inserted).toBe(1);
    expect(mockInsertUsageRecordsIgnoreDuplicates).toHaveBeenCalledOnce();
    const records = mockInsertUsageRecordsIgnoreDuplicates.mock.calls[0][1];
    expect(records[0].provider).toBe("anthropic");
    expect(records[0].project).toBe("replysequence");
    expect(records[0].requestId).toBe("abc-123");
  });

  it("inserts a batch of records", async () => {
    const body = {
      records: [
        { provider: "anthropic", model: "claude-sonnet-4", inputTokens: 100, outputTokens: 50, costUsd: 0.01 },
        { provider: "openai", model: "gpt-4o", inputTokens: 200, outputTokens: 100, costUsd: 0.02 },
      ],
    };
    const res = await POST(makeRequest(body, "test-ingest-key"));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.inserted).toBe(2);
  });

  it("returns 400 for missing required fields", async () => {
    const body = { provider: "anthropic" };
    const res = await POST(makeRequest(body, "test-ingest-key"));
    expect(res.status).toBe(400);
  });

  it("returns 400 for batch over 100 records", async () => {
    const records = Array.from({ length: 101 }, () => ({
      provider: "anthropic",
      model: "claude-sonnet-4",
      inputTokens: 100,
      outputTokens: 50,
      costUsd: 0.01,
    }));
    const res = await POST(makeRequest({ records }, "test-ingest-key"));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid project format", async () => {
    const body = {
      project: "INVALID CAPS & SPACES!",
      provider: "anthropic",
      model: "claude-sonnet-4",
      inputTokens: 100,
      outputTokens: 50,
      costUsd: 0.01,
    };
    const res = await POST(makeRequest(body, "test-ingest-key"));
    expect(res.status).toBe(400);
  });

  it("accepts record without project (defaults to null)", async () => {
    const body = {
      provider: "anthropic",
      model: "claude-sonnet-4",
      inputTokens: 100,
      outputTokens: 50,
      costUsd: 0.01,
    };
    const res = await POST(makeRequest(body, "test-ingest-key"));
    expect(res.status).toBe(201);
    const records = mockInsertUsageRecordsIgnoreDuplicates.mock.calls[0][1];
    expect(records[0].project).toBeNull();
  });
});
