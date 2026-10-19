import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deleteMe } from "../src/routes/delete-me.ts";
import { createSession } from "../src/routes/sessions.ts";
import { createTestTable, fakeOutsideWorld, httpEvent, parseBody, testDb, testDeps } from "./harness.ts";

describe("DELETE /api/me", () => {
  let table: Awaited<ReturnType<typeof createTestTable>>;
  beforeAll(async () => (table = await createTestTable()));
  afterAll(async () => table.drop());

  const put = (Item: Record<string, unknown>) => testDb.send(new PutCommand({ TableName: table.tableName, Item }));
  const item = async (PK: string, SK: string) =>
    (await testDb.send(new GetCommand({ TableName: table.tableName, Key: { PK, SK }, ConsistentRead: true }))).Item;
  const partition = async (PK: string) =>
    (
      await testDb.send(
        new QueryCommand({
          TableName: table.tableName,
          KeyConditionExpression: "PK = :pk",
          ExpressionAttributeValues: { ":pk": PK },
          ConsistentRead: true,
        }),
      )
    ).Items ?? [];

  const remove = (sub: string, fake = fakeOutsideWorld()) =>
    deleteMe(testDeps(table.tableName, fake))(httpEvent({ method: "DELETE", path: "/api/me", sub }));

  async function startSession(sub: string, fake = fakeOutsideWorld()) {
    const response = await createSession(testDeps(table.tableName, fake))(
      httpEvent({
        method: "POST",
        path: "/api/sessions",
        body: { sdpOffer: "v=0 offer", language: "pt-PT", level: "A2", topic: "my weekend" },
        sub,
      }),
    );
    expect(response.statusCode).toBe(201);
    return parseBody(response).sessionId as string;
  }

  it("deletes every item under the Learner's partition and their Cognito user", async () => {
    await put({ PK: "LEARNER#leaver", SK: "USAGE#2026-10-19", reservedSeconds: 300 });
    await put({ PK: "LEARNER#leaver", SK: "IMMERSION#pt-PT", partnerSeconds: 120 });
    await put({ PK: "LEARNER#leaver", SK: "SESSION#old", status: "ended", chargedSeconds: 60 });
    const fake = fakeOutsideWorld();

    const response = await remove("leaver", fake);

    expect(response.statusCode).toBe(204);
    expect(await partition("LEARNER#leaver")).toEqual([]);
    expect(fake.recorded.deletedUsers).toEqual(["leaver"]);
    expect(fake.recorded.hangups).toEqual([]);
  });

  it("deletes more items than fit in one batch", async () => {
    for (let i = 0; i < 60; i++) await put({ PK: "LEARNER#hoarder", SK: `SESSION#${i}`, status: "ended" });

    expect((await remove("hoarder")).statusCode).toBe(204);
    expect(await partition("LEARNER#hoarder")).toEqual([]);
  });

  it("hangs up and settles an active Session first, so GLOBAL keeps the usage", async () => {
    const fake = fakeOutsideWorld();
    await startSession("talker", fake);
    fake.clock.advance(5 * 60 * 1000);
    const globalBefore = (await item("GLOBAL", "USAGE#2026-10-19"))?.reservedSeconds;
    expect(globalBefore).toBeGreaterThanOrEqual(900);

    const response = await remove("talker", fake);

    expect(response.statusCode).toBe(204);
    expect(fake.recorded.hangups).toEqual(["rtc_fake_1"]);
    expect(await partition("LEARNER#talker")).toEqual([]);
    expect(fake.recorded.deletedUsers).toEqual(["talker"]);
    // The unused 10 of the 15 reserved minutes went back; the 5 used minutes stay counted globally.
    expect((await item("GLOBAL", "USAGE#2026-10-19"))?.reservedSeconds).toBe(globalBefore - 600);
  });

  it("leaves other Learners' items untouched", async () => {
    await put({ PK: "LEARNER#bystander", SK: "USAGE#2026-10-19", reservedSeconds: 100 });
    await put({ PK: "LEARNER#bystander", SK: "IMMERSION#fr-FR", partnerSeconds: 50 });
    await put({ PK: "LEARNER#bystander-2", SK: "IMMERSION#fr-FR", partnerSeconds: 7 });
    await put({ PK: "LEARNER#goner", SK: "IMMERSION#fr-FR", partnerSeconds: 9 });

    expect((await remove("goner")).statusCode).toBe(204);

    expect(await partition("LEARNER#bystander")).toHaveLength(2);
    expect(await partition("LEARNER#bystander-2")).toHaveLength(1);
    expect(await partition("LEARNER#goner")).toEqual([]);
  });

  it("deletes nothing when the active Session can't be hung up", async () => {
    const fake = fakeOutsideWorld();
    await startSession("stuck", fake);
    fake.steer.failHangup = true;

    const response = await remove("stuck", fake);

    expect(response.statusCode).toBe(502);
    expect((await partition("LEARNER#stuck")).length).toBeGreaterThan(0);
    expect(fake.recorded.deletedUsers).toEqual([]);
  });

  it("can be retried when removing the Cognito user fails after the data is gone", async () => {
    await put({ PK: "LEARNER#retry", SK: "IMMERSION#es-ES", partnerSeconds: 1 });
    const fake = fakeOutsideWorld();
    fake.steer.failDeleteUser = true;

    expect((await remove("retry", fake)).statusCode).toBe(502);
    expect(await partition("LEARNER#retry")).toEqual([]);

    fake.steer.failDeleteUser = false;
    expect((await remove("retry", fake)).statusCode).toBe(204);
    expect(fake.recorded.deletedUsers).toEqual(["retry"]);
  });
});
