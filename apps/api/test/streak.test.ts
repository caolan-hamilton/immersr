import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { hangUp } from "../src/routes/hang-up.ts";
import { endSession } from "../src/routes/end-session.ts";
import { me } from "../src/routes/me.ts";
import { createSession } from "../src/routes/sessions.ts";
import { createTestTable, fakeOutsideWorld, httpEvent, parseBody, testDb, testDeps } from "./harness.ts";

describe("Streak", () => {
  let table: Awaited<ReturnType<typeof createTestTable>>;
  beforeAll(async () => (table = await createTestTable()));
  afterAll(async () => table.drop());
  beforeEach(async () => {
    for (let day = 15; day <= 25; day++) {
      await testDb.send(new DeleteCommand({ TableName: table.tableName, Key: { PK: "GLOBAL", SK: `USAGE#2026-10-${day}` } }));
    }
  });

  const body = { sdpOffer: "v=0 offer", language: "pt-PT", level: "A2", topic: "my weekend" };
  const owner = (sub: string) => ({ sub, groups: ["admins"] });

  /** Starts a Session at `at` and returns what's needed to settle it. */
  async function start(sub: string, at: string, timeZone?: string) {
    const fake = fakeOutsideWorld(new Date(at));
    const deps = testDeps(table.tableName, fake);
    const response = await createSession(deps)(
      httpEvent({ method: "POST", path: "/api/sessions", body: { ...body, timeZone }, ...owner(sub) }),
    );
    expect(response.statusCode).toBe(201);
    const { sessionId } = parseBody(response);
    return {
      end: () =>
        endSession(deps)(
          httpEvent({ method: "POST", path: `/api/sessions/${sessionId}/end`, pathParameters: { id: sessionId }, body: { partnerSeconds: 10 }, sub }),
        ),
      timeOut: () => hangUp(deps)({ sub, sessionId, callId: "rtc_fake_1" }),
      fake,
    };
  }

  async function streakAt(sub: string, at: string, timeZone?: string) {
    const deps = testDeps(table.tableName, fakeOutsideWorld(new Date(at)));
    const query = timeZone ? { queryStringParameters: { timeZone } } : {};
    const result = await me(deps)({ ...httpEvent({ path: "/api/me", sub }), ...query });
    return parseBody(result).streak;
  }

  it("is 1 after a first Session", async () => {
    const s = await start("first", "2026-10-19T12:00:00Z");
    await s.end();
    expect(await streakAt("first", "2026-10-19T13:00:00Z")).toBe(1);
  });

  it("counts up on consecutive local days", async () => {
    for (const day of ["19", "20", "21"]) await (await start("climber", `2026-10-${day}T12:00:00Z`)).end();
    expect(await streakAt("climber", "2026-10-21T13:00:00Z")).toBe(3);
  });

  it("counts two Sessions on one day once", async () => {
    await (await start("twice", "2026-10-19T09:00:00Z")).end();
    await (await start("twice", "2026-10-19T15:00:00Z")).end();
    expect(await streakAt("twice", "2026-10-19T16:00:00Z")).toBe(1);
  });

  it("restarts at 1 after a missed day", async () => {
    await (await start("misser", "2026-10-19T12:00:00Z")).end();
    await (await start("misser", "2026-10-20T12:00:00Z")).end();
    await (await start("misser", "2026-10-22T12:00:00Z")).end();
    expect(await streakAt("misser", "2026-10-22T13:00:00Z")).toBe(1);
  });

  it("counts a timed-out Session", async () => {
    const s = await start("sleeper", "2026-10-19T12:00:00Z");
    s.fake.clock.advance(15 * 60 * 1000);
    await s.timeOut();
    expect(await streakAt("sleeper", "2026-10-19T13:00:00Z")).toBe(1);
  });

  it("never counts a released Session", async () => {
    const fake = fakeOutsideWorld(new Date("2026-10-19T12:00:00Z"));
    fake.steer.failCreateCall = true;
    const response = await createSession(testDeps(table.tableName, fake))(
      httpEvent({ method: "POST", path: "/api/sessions", body, ...owner("released") }),
    );
    expect(response.statusCode).toBe(502);
    expect(await streakAt("released", "2026-10-19T13:00:00Z")).toBe(0);
  });

  it("GET /me keeps the Streak when the last day was yesterday, and gives 0 before that", async () => {
    await (await start("fading", "2026-10-19T12:00:00Z")).end();
    expect(await streakAt("fading", "2026-10-20T12:00:00Z")).toBe(1);
    expect(await streakAt("fading", "2026-10-21T12:00:00Z")).toBe(0);
  });

  it("counts a 23:30 Session in America/New_York for that local day", async () => {
    // 23:30 on the 19th in New York is 03:30 UTC on the 20th.
    await (await start("nyc", "2026-10-20T03:30:00Z", "America/New_York")).end();
    await (await start("nyc", "2026-10-20T14:00:00Z", "America/New_York")).end();
    expect(await streakAt("nyc", "2026-10-20T15:00:00Z", "America/New_York")).toBe(2);
  });

  it("falls back to UTC for an invalid time zone", async () => {
    await (await start("nowhere", "2026-10-19T23:30:00Z", "Mars/Olympus_Mons")).end();
    await (await start("nowhere", "2026-10-20T00:30:00Z", "Mars/Olympus_Mons")).end();
    expect(await streakAt("nowhere", "2026-10-20T01:00:00Z", "Mars/Olympus_Mons")).toBe(2);
  });
});
