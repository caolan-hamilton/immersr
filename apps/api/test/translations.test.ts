import { DeleteCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { TRANSLATION_MAX_LENGTH } from "@immersr/shared";
import { endSession } from "../src/routes/end-session.ts";
import { createSession } from "../src/routes/sessions.ts";
import { translate } from "../src/routes/translations.ts";
import { createTestTable, fakeOutsideWorld, httpEvent, parseBody, testDb, testDeps } from "./harness.ts";

describe("POST /api/translations", () => {
  let table: Awaited<ReturnType<typeof createTestTable>>;
  beforeAll(async () => (table = await createTestTable()));
  afterAll(async () => table.drop());
  // The global counter is shared by every test, so each starts from an empty day.
  beforeEach(async () => {
    await testDb.send(new DeleteCommand({ TableName: table.tableName, Key: { PK: "GLOBAL", SK: "USAGE#2026-10-19" } }));
  });

  const valid = { sdpOffer: "v=0 offer", language: "pt-PT", level: "A2", topic: "my weekend" };
  const usage = async (sub: string) =>
    (await testDb.send(new GetCommand({ TableName: table.tableName, Key: { PK: `LEARNER#${sub}`, SK: "USAGE#2026-10-19" } })))
      .Item;

  /** Starts a Session for `sub`; each test uses its own sub so counters don't mix. */
  async function start(sub: string, fake = fakeOutsideWorld()) {
    const deps = testDeps(table.tableName, fake);
    const response = await createSession(deps)(httpEvent({ method: "POST", path: "/api/sessions", body: valid, sub }));
    expect(response.statusCode).toBe(201);
    const { sessionId } = parseBody(response);
    const ask = (body: unknown, as = sub) =>
      translate(deps)(httpEvent({ method: "POST", path: "/api/translations", body, sub: as }));
    return { sessionId, fake, deps, ask };
  }

  it("translates a Partner Turn from the Session's Target language", async () => {
    const { sessionId, ask, fake } = await start("translator");

    const response = await ask({ sessionId, text: "Olá, como estás?" });

    expect(response.statusCode).toBe(200);
    expect(parseBody(response)).toEqual({ translation: "[en] Olá, como estás?" });
    expect(fake.recorded.translations).toEqual([{ text: "Olá, como estás?", language: "pt-PT" }]);
    expect((await usage("translator"))?.translationCount).toBe(1);
  });

  it("refuses once the Session has ended, without translating or counting", async () => {
    const { sessionId, ask, fake, deps } = await start("ended-translator");
    await endSession(deps)(
      httpEvent({
        method: "POST",
        path: `/api/sessions/${sessionId}/end`,
        pathParameters: { id: sessionId },
        body: { partnerSeconds: 0 },
        sub: "ended-translator",
      }),
    );

    const response = await ask({ sessionId, text: "Olá" });

    expect(response.statusCode).toBe(409);
    expect(fake.recorded.translations).toHaveLength(0);
    expect((await usage("ended-translator"))?.translationCount).toBeUndefined();
  });

  it("refuses another Learner's Session", async () => {
    const { sessionId, ask, fake } = await start("owner");

    const response = await ask({ sessionId, text: "Olá" }, "intruder");

    expect(response.statusCode).toBe(409);
    expect(fake.recorded.translations).toHaveLength(0);
    expect(await usage("intruder")).toBeUndefined();
  });

  it("refuses text over the length limit but accepts text exactly at it", async () => {
    const { sessionId, ask, fake } = await start("wordy");

    const tooLong = await ask({ sessionId, text: "a".repeat(TRANSLATION_MAX_LENGTH + 1) });
    expect(tooLong.statusCode).toBe(400);
    expect(fake.recorded.translations).toHaveLength(0);

    const atLimit = await ask({ sessionId, text: "a".repeat(TRANSLATION_MAX_LENGTH) });
    expect(atLimit.statusCode).toBe(200);
  });

  it("allows 200 translations a UTC day, then gives 429, and resets the next day", async () => {
    const { sessionId, ask, fake } = await start("heavy-user");
    await testDb.send(
      new UpdateCommand({
        TableName: table.tableName,
        Key: { PK: "LEARNER#heavy-user", SK: "USAGE#2026-10-19" },
        UpdateExpression: "SET translationCount = :n",
        ExpressionAttributeValues: { ":n": 199 },
      }),
    );

    expect((await ask({ sessionId, text: "Olá" })).statusCode).toBe(200);
    const refused = await ask({ sessionId, text: "Olá" });

    expect(refused.statusCode).toBe(429);
    expect(fake.recorded.translations).toHaveLength(1);
    expect((await usage("heavy-user"))?.translationCount).toBe(200);

    fake.clock.set(new Date("2026-10-20T00:00:01Z"));
    expect((await ask({ sessionId, text: "Olá" })).statusCode).toBe(200);
  });

  it("gives back the count when translating fails", async () => {
    const fake = fakeOutsideWorld();
    const { sessionId, ask } = await start("unlucky", fake);
    fake.world.translate.toEnglish = async () => {
      throw new Error("fake Translate failure");
    };

    const response = await ask({ sessionId, text: "Olá" });

    expect(response.statusCode).toBe(502);
    expect((await usage("unlucky"))?.translationCount).toBe(0);
  });
});
