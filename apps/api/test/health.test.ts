import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HealthResponse } from "@crosstalki/shared";
import { health } from "../src/routes/health.ts";
import { createTestTable, fakeOutsideWorld, httpEvent, parseBody, testDeps } from "./harness.ts";

describe("GET /api/health", () => {
  let table: Awaited<ReturnType<typeof createTestTable>>;
  beforeAll(async () => (table = await createTestTable()));
  afterAll(async () => table.drop());

  it("reports ok, including the table being reachable", async () => {
    const fake = fakeOutsideWorld(new Date("2026-10-19T08:30:00Z"));
    const result = await health(testDeps(table.tableName, fake))(httpEvent({ path: "/api/health" }));

    expect(result.statusCode).toBe(200);
    expect(HealthResponse.parse(parseBody(result))).toEqual({
      status: "ok",
      stage: "test",
      time: "2026-10-19T08:30:00.000Z",
      db: "ok",
    });
  });

  it("fails when the table doesn't exist", async () => {
    await expect(health(testDeps("no-such-table"))(httpEvent({ path: "/api/health" }))).rejects.toThrow();
  });
});
