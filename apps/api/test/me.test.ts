import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MeResponse } from "@immersr/shared";
import { me } from "../src/routes/me.ts";
import { createTestTable, fakeOutsideWorld, httpEvent, parseBody, testDb, testDeps } from "./harness.ts";

describe("GET /api/me", () => {
  let table: Awaited<ReturnType<typeof createTestTable>>;
  beforeAll(async () => (table = await createTestTable()));
  afterAll(async () => table.drop());

  const get = (opts: { sub?: string; groups?: string[] } = {}) => {
    const fake = fakeOutsideWorld(new Date("2026-10-19T18:30:00Z"));
    return me(testDeps(table.tableName, fake))(httpEvent({ path: "/api/me", ...opts }));
  };

  it("gives a new Learner the full 15 minute allowance and no Immersion time", async () => {
    const result = await get({ sub: "new-learner" });

    expect(result.statusCode).toBe(200);
    expect(MeResponse.parse(parseBody(result))).toEqual({
      allowance: { usedSeconds: 0, limitSeconds: 900, resetsAt: "2026-10-20T00:00:00.000Z" },
      immersion: {},
      streak: 0,
    });
  });

  it("gives an admin the 90 minute allowance", async () => {
    const result = await get({ sub: "owner", groups: ["admins"] });

    expect(parseBody(result).allowance).toEqual({
      usedSeconds: 0,
      limitSeconds: 5400,
      resetsAt: "2026-10-20T00:00:00.000Z",
    });
  });

  it("reports today's usage and Immersion time per language, only for the caller", async () => {
    const put = (Item: Record<string, unknown>) => testDb.send(new PutCommand({ TableName: table.tableName, Item }));
    await put({ PK: "LEARNER#active", SK: "USAGE#2026-10-19", reservedSeconds: 300 });
    await put({ PK: "LEARNER#active", SK: "USAGE#2026-10-18", reservedSeconds: 900 });
    await put({ PK: "LEARNER#active", SK: "IMMERSION#es", partnerSeconds: 120 });
    await put({ PK: "LEARNER#active", SK: "IMMERSION#fr", partnerSeconds: 45 });
    await put({ PK: "LEARNER#other", SK: "IMMERSION#de", partnerSeconds: 999 });

    const result = await get({ sub: "active" });

    expect(parseBody(result)).toEqual({
      allowance: { usedSeconds: 300, limitSeconds: 900, resetsAt: "2026-10-20T00:00:00.000Z" },
      immersion: { es: 120, fr: 45 },
      streak: 0,
    });
  });
});
