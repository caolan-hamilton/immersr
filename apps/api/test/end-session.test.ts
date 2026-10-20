import { DeleteCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { EndSessionResponse } from "@immersr/shared";
import { endSession } from "../src/routes/end-session.ts";
import { getSession, settle } from "../src/lib/metering.ts";
import { me } from "../src/routes/me.ts";
import { createSession } from "../src/routes/sessions.ts";
import { createTestTable, fakeOutsideWorld, httpEvent, parseBody, testDb, testDeps } from "./harness.ts";

describe("POST /api/sessions/{id}/end", () => {
  let table: Awaited<ReturnType<typeof createTestTable>>;
  beforeAll(async () => (table = await createTestTable()));
  afterAll(async () => table.drop());
  // The global counter is shared by every test, so each starts from empty days.
  beforeEach(async () => {
    for (const day of ["2026-10-19", "2026-10-20"]) {
      await testDb.send(new DeleteCommand({ TableName: table.tableName, Key: { PK: "GLOBAL", SK: `USAGE#${day}` } }));
    }
  });

  const valid = { sdpOffer: "v=0 offer", language: "pt-PT", level: "beginner", topic: "my weekend" };
  const item = async (PK: string, SK: string) =>
    (await testDb.send(new GetCommand({ TableName: table.tableName, Key: { PK, SK } }))).Item;

  /** Starts a Session at the fake's current time. Each test uses its own sub so counters don't mix. */
  async function start(sub: string, fake = fakeOutsideWorld()) {
    const deps = testDeps(table.tableName, fake);
    const response = await createSession(deps)(
      httpEvent({ method: "POST", path: "/api/sessions", body: valid, groups: ["admins"], sub }),
    );
    expect(response.statusCode).toBe(201);
    const { sessionId } = parseBody(response);
    const end = (partnerSeconds: number, as = sub) =>
      endSession(deps)(
        httpEvent({
          method: "POST",
          path: `/api/sessions/${sessionId}/end`,
          pathParameters: { id: sessionId },
          body: { partnerSeconds },
          sub: as,
        }),
      );
    return { sessionId, fake, deps, end };
  }

  it("charges the elapsed time, refunds the rest, and adds Immersion time", async () => {
    const { fake, end, sessionId } = await start("ender");
    fake.clock.advance(5 * 60 * 1000);

    const response = await end(200);

    expect(response.statusCode).toBe(200);
    expect(EndSessionResponse.parse(parseBody(response))).toEqual({
      chargedSeconds: 300,
      immersionSeconds: 200,
      returnedSeconds: 600,
    });
    expect(fake.recorded.hangups).toEqual(["rtc_fake_1"]);
    expect((await item("LEARNER#ender", "USAGE#2026-10-19"))?.reservedSeconds).toBe(300);
    expect((await item("LEARNER#ender", "IMMERSION#pt-PT"))?.partnerSeconds).toBe(200);
    expect(await item("LEARNER#ender", `SESSION#${sessionId}`)).toMatchObject({
      status: "ended",
      chargedSeconds: 300,
      endedAt: "2026-10-19T12:05:00.000Z",
    });
  });

  it.each(["A1", "A2", "B1", "B2"])("still ends and reads a Session stored before the Level bands changed (%s)", async (level) => {
    const sub = `old-${level}`;
    const { sessionId, end } = await start(sub);
    await testDb.send(
      new UpdateCommand({
        TableName: table.tableName,
        Key: { PK: `LEARNER#${sub}`, SK: `SESSION#${sessionId}` },
        UpdateExpression: "SET #level = :level",
        ExpressionAttributeNames: { "#level": "level" },
        ExpressionAttributeValues: { ":level": level },
      }),
    );

    const response = await end(60);

    expect(response.statusCode).toBe(200);
    expect(await item(`LEARNER#${sub}`, `SESSION#${sessionId}`)).toMatchObject({ level, status: "ended" });
  });

  it("hangs up before settling: a failed hang-up gives 502, leaves the Session active, and a retry settles", async () => {
    const { fake, end, sessionId } = await start("unhung");
    fake.clock.advance(2 * 60 * 1000);
    fake.steer.failHangup = true;

    const failed = await end(90);

    expect(failed.statusCode).toBe(502);
    expect(fake.recorded.hangups).toHaveLength(0);
    expect(await item("LEARNER#unhung", `SESSION#${sessionId}`)).toMatchObject({ status: "active" });
    expect((await item("LEARNER#unhung", "USAGE#2026-10-19"))?.reservedSeconds).toBe(900);
    expect(await item("LEARNER#unhung", "IMMERSION#pt-PT")).toBeUndefined();

    fake.steer.failHangup = false;
    fake.clock.advance(60 * 1000);
    const retried = await end(90);

    expect(retried.statusCode).toBe(200);
    expect(parseBody(retried)).toEqual({ chargedSeconds: 180, immersionSeconds: 90, returnedSeconds: 720 });
    expect(fake.recorded.hangups).toEqual(["rtc_fake_1"]);
    expect((await item("LEARNER#unhung", "USAGE#2026-10-19"))?.reservedSeconds).toBe(180);
  });

  it("never charges more than the reserved length", async () => {
    const { fake, end } = await start("overtimer");
    fake.clock.advance(40 * 60 * 1000);

    expect(parseBody(await end(0)).chargedSeconds).toBe(900);
  });

  it("caps reported Partner seconds at the charged length", async () => {
    const { fake, end } = await start("fibber");
    fake.clock.advance(60 * 1000);

    expect(parseBody(await end(5000))).toEqual({ chargedSeconds: 60, immersionSeconds: 60, returnedSeconds: 840 });
    expect((await item("LEARNER#fibber", "IMMERSION#pt-PT"))?.partnerSeconds).toBe(60);
  });

  it("returns the stored result on a repeat End without settling twice", async () => {
    const { fake, end } = await start("repeater");
    fake.clock.advance(120 * 1000);
    const first = await end(100);
    fake.clock.advance(120 * 1000);

    const second = await end(100);

    expect(parseBody(second)).toEqual(parseBody(first));
    expect(parseBody(second).returnedSeconds).toBe(780);
    expect((await item("LEARNER#repeater", "USAGE#2026-10-19"))?.reservedSeconds).toBe(120);
    expect((await item("LEARNER#repeater", "IMMERSION#pt-PT"))?.partnerSeconds).toBe(100);
  });

  it("accepts a late End after the scheduled hang-up timed the Session out, without error or a second settlement", async () => {
    const { fake, deps, sessionId, end } = await start("latecomer");
    fake.clock.advance(15 * 60 * 1000);
    const session = (await getSession(deps, "latecomer", sessionId))!;
    await settle(deps, "latecomer", session, "timed-out", 0);
    fake.clock.advance(60 * 60 * 1000);

    const response = await end(600);

    expect(response.statusCode).toBe(200);
    expect(EndSessionResponse.parse(parseBody(response))).toEqual({
      chargedSeconds: 900,
      immersionSeconds: 0,
      returnedSeconds: 0,
    });
    expect((await item("LEARNER#latecomer", "USAGE#2026-10-19"))?.reservedSeconds).toBe(900);
    expect(await item("LEARNER#latecomer", "IMMERSION#pt-PT")).toBeUndefined();
  });

  it("settles once when two End calls race", async () => {
    const { fake, end } = await start("racer");
    fake.clock.advance(60 * 1000);

    const [a, b] = await Promise.all([end(30), end(30)]);

    expect(parseBody(a)).toEqual(parseBody(b));
    expect((await item("LEARNER#racer", "IMMERSION#pt-PT"))?.partnerSeconds).toBe(30);
    expect((await item("LEARNER#racer", "USAGE#2026-10-19"))?.reservedSeconds).toBe(60);
  });

  it("returns 404 for another Learner's Session and leaves it active", async () => {
    const { sessionId, end } = await start("owner-of-session");

    const response = await end(0, "someone-else");

    expect(response.statusCode).toBe(404);
    expect((await item("LEARNER#owner-of-session", `SESSION#${sessionId}`))?.status).toBe("active");
  });

  it("returns 404 for a Session that doesn't exist", async () => {
    const deps = testDeps(table.tableName);
    const response = await endSession(deps)(
      httpEvent({ method: "POST", path: "/x", pathParameters: { id: "nope" }, body: { partnerSeconds: 0 } }),
    );

    expect(response.statusCode).toBe(404);
  });

  it("rejects a malformed body with 400", async () => {
    const { deps, sessionId } = await start("sloppy");
    const response = await endSession(deps)(
      httpEvent({ method: "POST", path: "/x", pathParameters: { id: sessionId }, body: { partnerSeconds: -3 }, sub: "sloppy" }),
    );

    expect(response.statusCode).toBe(400);
  });

  it("refunds the day the Session was reserved against when it ends after UTC midnight", async () => {
    const fake = fakeOutsideWorld(new Date("2026-10-19T23:58:00Z"));
    const { end } = await start("midnight", fake);
    fake.clock.advance(4 * 60 * 1000); // now 00:02 on the 20th

    const response = await end(100);

    expect(parseBody(response).chargedSeconds).toBe(240);
    expect((await item("LEARNER#midnight", "USAGE#2026-10-19"))?.reservedSeconds).toBe(240);
    expect(await item("LEARNER#midnight", "USAGE#2026-10-20")).toBeUndefined();
    expect((await item("GLOBAL", "USAGE#2026-10-20"))).toBeUndefined();
  });

  it("is reflected in GET /me: usage and Immersion totals", async () => {
    const { fake, end, deps } = await start("tracked");
    fake.clock.advance(3 * 60 * 1000);
    await end(150);

    const response = await me(deps)(httpEvent({ path: "/api/me", sub: "tracked" }));

    expect(parseBody(response)).toEqual({
      allowance: { usedSeconds: 180, limitSeconds: 900, resetsAt: "2026-10-20T00:00:00.000Z" },
      immersion: { "pt-PT": 150 },
      streak: 1,
    });
  });
});
