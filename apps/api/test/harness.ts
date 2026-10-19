// The API test seam: call route handlers with HTTP API events, against a real
// DynamoDB Local table, with the outside world replaced by fakes.
import { randomUUID } from "node:crypto";
import { CreateTableCommand, DeleteTableCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import type { Deps } from "../src/lib/deps.ts";
import type { HangupTarget, OutsideWorld } from "../src/lib/outside-world.ts";
import { TABLE } from "../src/lib/table.ts";
import { DYNAMODB_LOCAL_ENDPOINT } from "./dynamodb-local.ts";

const client = new DynamoDBClient({
  endpoint: DYNAMODB_LOCAL_ENDPOINT,
  region: "eu-west-1",
  credentials: { accessKeyId: "local", secretAccessKey: "local" },
});
const db = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });
/** For arranging table contents in tests. */
export const testDb = db;

/** Creates a fresh table with the production key design; call `drop` in afterAll. */
export async function createTestTable() {
  const tableName = `test-${randomUUID()}`;
  await client.send(
    new CreateTableCommand({
      TableName: tableName,
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [
        { AttributeName: TABLE.partitionKey, AttributeType: "S" },
        { AttributeName: TABLE.sortKey, AttributeType: "S" },
      ],
      KeySchema: [
        { AttributeName: TABLE.partitionKey, KeyType: "HASH" },
        { AttributeName: TABLE.sortKey, KeyType: "RANGE" },
      ],
    }),
  );
  return { tableName, drop: () => client.send(new DeleteTableCommand({ TableName: tableName })) };
}

export type FakeWorld = ReturnType<typeof fakeOutsideWorld>;

/** Fakes for every outside-world dependency. They record what they received and can be steered. */
export function fakeOutsideWorld(start = new Date("2026-10-19T12:00:00Z")) {
  let now = start;
  let callCount = 0;
  const recorded = {
    createCalls: [] as { sdpOffer: string; sessionConfig: unknown }[],
    hangups: [] as string[],
    moderated: [] as string[],
    schedules: [] as { target: HangupTarget; at: Date }[],
    translations: [] as { text: string; language: string }[],
    deletedUsers: [] as string[],
  };
  const steer = {
    failCreateCall: false,
    failHangup: false,
    failDeleteUser: false,
    failSchedule: false,
    flagTopics: false,
  };

  const world: OutsideWorld = {
    openai: {
      async createCall(sdpOffer, sessionConfig) {
        if (steer.failCreateCall) throw new Error("fake OpenAI failure");
        recorded.createCalls.push({ sdpOffer, sessionConfig });
        callCount += 1;
        return { sdpAnswer: `answer-for:${sdpOffer}`, callId: `rtc_fake_${callCount}` };
      },
      async hangup(callId) {
        if (steer.failHangup) throw new Error("fake OpenAI hangup failure");
        recorded.hangups.push(callId);
      },
      async moderate(text) {
        recorded.moderated.push(text);
        return { flagged: steer.flagTopics };
      },
    },
    scheduler: {
      async scheduleHangup(target, at) {
        if (steer.failSchedule) throw new Error("fake scheduler failure");
        recorded.schedules.push({ target, at });
      },
    },
    translate: {
      async toEnglish(text, language) {
        recorded.translations.push({ text, language });
        return `[en] ${text}`;
      },
    },
    identity: {
      async deleteUser(sub) {
        if (steer.failDeleteUser) throw new Error("fake Cognito failure");
        recorded.deletedUsers.push(sub);
      },
    },
    clock: { now: () => now },
  };

  return {
    world,
    recorded,
    steer,
    clock: {
      set: (date: Date) => (now = date),
      advance: (ms: number) => (now = new Date(now.getTime() + ms)),
    },
  };
}

export function testDeps(tableName: string, fake: FakeWorld = fakeOutsideWorld()): Deps {
  return { db, tableName, stage: "test", world: fake.world };
}

interface EventInput {
  method?: string;
  path: string;
  body?: unknown;
  pathParameters?: Record<string, string>;
  sub?: string;
  groups?: string[];
}

/** Builds an HTTP API (payload v2) event, with JWT claims as the Cognito authorizer would set them. */
export function httpEvent({ method = "GET", path, body, pathParameters, sub = "learner-1", groups = [] }: EventInput) {
  return {
    version: "2.0",
    routeKey: `${method} ${path}`,
    rawPath: path,
    rawQueryString: "",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    isBase64Encoded: false,
    pathParameters,
    requestContext: {
      accountId: "000000000000",
      apiId: "test",
      domainName: "test.local",
      domainPrefix: "test",
      http: { method, path, protocol: "HTTP/1.1", sourceIp: "127.0.0.1", userAgent: "vitest" },
      requestId: randomUUID(),
      routeKey: `${method} ${path}`,
      stage: "$default",
      time: "",
      timeEpoch: 0,
      authorizer: {
        principalId: "",
        integrationLatency: 0,
        jwt: { claims: { sub, ...(groups.length ? { "cognito:groups": `[${groups.join(" ")}]` } : {}) }, scopes: [] },
      },
    },
  } satisfies APIGatewayProxyEventV2WithJWTAuthorizer;
}

export const parseBody = (result: { body?: string }) => JSON.parse(result.body ?? "null");
