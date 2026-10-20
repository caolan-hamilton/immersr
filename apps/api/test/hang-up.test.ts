import { DeleteCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { endSession } from "../src/routes/end-session.ts";
import { hangUp } from "../src/routes/hang-up.ts";
import { createSession } from "../src/routes/sessions.ts";
import { createTestTable, fakeOutsideWorld, httpEvent, parseBody, testDb, testDeps } from "./harness.ts";

describe("scheduled hang-up", () => {
  let table: Awaited<ReturnType<typeof createTestTable>>;
  beforeAll(async () => (table = await createTestTable()));
  afterAll(async () => table.drop());
  beforeEach(async () => {
    for (const day of ["2026-10-19", "2026-10-20"]) {
      await testDb.send(new DeleteCommand({ TableName: table.tableName, Key: { PK: "GLOBAL", SK: `USAGE#${day}` } }));
    }
  });

  const valid = { sdpOffer: "v=0 offer", language: "pt-PT", level: "A2", topic: "my weekend" };
  const item = async (PK: string, SK: string) =>
    (await testDb.send(new GetCommand({ TableName: table.tableName, Key: { PK, SK } }))).Item;

  async function start(sub: string, fake = fakeOutsideWorld()) {
    const deps = testDeps(table.tableName, fake);
    const response = await createSession(deps)(httpEvent({ method: "POST", path: "/api/sessions", body: valid, groups: ["admins"], sub }));
    expect(response.statusCode).toBe(201);
    const { sessionId } = parseBody(response);
    const end = (partnerSeconds: number) =>
      endSession(deps)(
        httpEvent({
          method: "POST",
          path: `/api/sessions/${sessionId}/end`,
          pathParameters: { id: sessionId },
          body: { partnerSeconds },
          sub,
        }),
      );
    /** Fires the Session's schedule: the clock reaches its time, then the hang-up handler gets its payload. */
    const fire = async () => {
      const schedule = fake.recorded.schedules.find((s) => s.target.sessionId === sessionId)!;
      fake.clock.set(schedule.at);
      await hangUp(deps)(schedule.target);
    };
    return { sessionId, fake, deps, end, fire };
  }

  it("schedules the hang-up for start + maximum Session length, carrying sub, Session ID and call ID", async () => {
    const { fake, sessionId } = await start("scheduled");

    expect(fake.recorded.schedules).toEqual([
      {
        target: { sub: "scheduled", sessionId, callId: "rtc_fake_1" },
        at: new Date("2026-10-19T12:15:00Z"),
      },
    ]);
  });

  it("releases the Reservation and answers 502 when the hang-up can't be scheduled", async () => {
    const fake = fakeOutsideWorld();
    fake.steer.failSchedule = true;
    const deps = testDeps(table.tableName, fake);

    const response = await createSession(deps)(
      httpEvent({ method: "POST", path: "/api/sessions", body: valid, groups: ["admins"], sub: "unschedulable" }),
    );

    expect(response.statusCode).toBe(502);
    expect(fake.recorded.hangups).toEqual(["rtc_fake_1"]);
    expect((await item("LEARNER#unschedulable", "USAGE#2026-10-19"))?.reservedSeconds).toBe(0);
  });

  it("hangs up the call and settles as timed-out, charging the full Reservation", async () => {
    const { fake, fire, sessionId } = await start("walker-away");

    await fire();

    expect(fake.recorded.hangups).toEqual(["rtc_fake_1"]);
    expect(await item("LEARNER#walker-away", `SESSION#${sessionId}`)).toMatchObject({
      status: "timed-out",
      chargedSeconds: 900,
      immersionSeconds: 0,
    });
    expect((await item("LEARNER#walker-away", "USAGE#2026-10-19"))?.reservedSeconds).toBe(900);
  });

  it("adds no Immersion time when the Learner never reported Partner seconds", async () => {
    const { fire } = await start("silent");

    await fire();

    expect(await item("LEARNER#silent", "IMMERSION#pt-PT")).toBeUndefined();
  });

  it("returns the timed-out result when End arrives after the hang-up", async () => {
    const { fire, end } = await start("late-ender");
    await fire();

    const response = await end(500);

    expect(response.statusCode).toBe(200);
    expect(parseBody(response)).toEqual({ chargedSeconds: 900, immersionSeconds: 0 });
    expect(await item("LEARNER#late-ender", "IMMERSION#pt-PT")).toBeUndefined();
    expect((await item("LEARNER#late-ender", "USAGE#2026-10-19"))?.reservedSeconds).toBe(900);
  });

  it("changes nothing when the hang-up fires after End", async () => {
    const { fake, fire, end, sessionId } = await start("early-ender");
    fake.clock.advance(2 * 60 * 1000);
    const ended = await end(60);

    await fire();

    expect(parseBody(ended)).toEqual({ chargedSeconds: 120, immersionSeconds: 60 });
    expect(fake.recorded.hangups).toEqual(["rtc_fake_1"]);
    expect(await item("LEARNER#early-ender", `SESSION#${sessionId}`)).toMatchObject({
      status: "ended",
      chargedSeconds: 120,
    });
    expect((await item("LEARNER#early-ender", "USAGE#2026-10-19"))?.reservedSeconds).toBe(120);
    expect((await item("LEARNER#early-ender", "IMMERSION#pt-PT"))?.partnerSeconds).toBe(60);
  });

  it("settles once when the hang-up and End race", async () => {
    const { fake, fire, end } = await start("racer");
    fake.clock.set(new Date("2026-10-19T12:15:00Z"));

    const [, ended] = await Promise.all([fire(), end(100)]);

    const stored = parseBody(ended);
    expect(stored.chargedSeconds).toBe(900);
    expect((await item("LEARNER#racer", "USAGE#2026-10-19"))?.reservedSeconds).toBe(900);
  });

  it("stays active, so the scheduler can retry, when the OpenAI hang-up fails", async () => {
    const { fake, fire, sessionId } = await start("retry");
    fake.steer.failHangup = true;

    await expect(fire()).rejects.toThrow();
    expect((await item("LEARNER#retry", `SESSION#${sessionId}`))?.status).toBe("active");

    fake.steer.failHangup = false;
    await fire();
    expect((await item("LEARNER#retry", `SESSION#${sessionId}`))?.status).toBe("timed-out");
  });

  it("does nothing for a Session that no longer exists", async () => {
    const deps = testDeps(table.tableName);

    await expect(hangUp(deps)({ sub: "gone", sessionId: "nope", callId: "rtc_x" })).resolves.toBeUndefined();
  });
});
