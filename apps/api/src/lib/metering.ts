// Reserve-then-settle metering (ADR 0004, ADR 0006). Every function here is one DynamoDB transaction.
import { GetCommand, TransactWriteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ConditionalCheckFailedException, TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import type { SessionRefusal } from "@immersr/shared";
import type { Deps } from "./deps.ts";
import { DAILY_TRANSLATION_LIMIT, GLOBAL_DAILY_CAP_SECONDS, MAX_SESSION_SECONDS, USAGE_TTL_SECONDS } from "./limits.ts";
import { previousDay, usageDay } from "./learner.ts";
import { TABLE } from "./table.ts";

const { partitionKey: PK, sortKey: SK, ttlAttribute: TTL } = TABLE;

export const learnerKey = (sub: string) => `LEARNER#${sub}`;
export const sessionKey = (sub: string, sessionId: string) => ({ [PK]: learnerKey(sub), [SK]: `SESSION#${sessionId}` });
const usageKey = (pk: string, day: string) => ({ [PK]: pk, [SK]: `USAGE#${day}` });

export interface SessionItem {
  sessionId: string;
  callId?: string;
  status: "active" | "ended" | "timed-out" | "released";
  language: string;
  level: string;
  topic: string;
  usageDay: string;
  /** The Learner's calendar day when the Session started, in their time zone (for the Streak). */
  localDay: string;
  startedAt: string;
  endsAt: string;
  reservedSeconds: number;
  endedAt?: string;
  chargedSeconds?: number;
  immersionSeconds?: number;
}

/** Usage items expire a week after the day they count. */
const usageTtl = (day: string) => Math.floor(new Date(`${day}T00:00:00Z`).getTime() / 1000) + USAGE_TTL_SECONDS;

/** Adds `delta` seconds to a usage item; with `ceiling`, only if the total stays at or under it. */
const addUsage = (deps: Deps, pk: string, day: string, delta: number, ceiling?: number) => ({
  Update: {
    TableName: deps.tableName,
    Key: usageKey(pk, day),
    UpdateExpression: "ADD reservedSeconds :delta SET #ttl = :ttl",
    ExpressionAttributeNames: { "#ttl": TTL },
    ExpressionAttributeValues: {
      ":delta": delta,
      ":ttl": usageTtl(day),
      ...(ceiling === undefined ? {} : { ":room": ceiling - delta }),
    },
    ...(ceiling === undefined
      ? {}
      : { ConditionExpression: "attribute_not_exists(reservedSeconds) OR reservedSeconds <= :room" }),
  },
});

export interface ReserveInput {
  sub: string;
  isAdmin: boolean;
  allowanceSeconds: number;
  session: Omit<SessionItem, "status" | "usageDay" | "reservedSeconds">;
}

/**
 * Holds the maximum Session length against the Learner's Daily allowance and the global daily cap, and stores
 * the `active` Session, atomically. Admins skip the global cap but their usage still counts.
 */
export async function reserve(
  deps: Deps,
  { sub, isAdmin, allowanceSeconds, session }: ReserveInput,
): Promise<{ ok: true; session: SessionItem } | ({ ok: false } & SessionRefusal)> {
  const day = usageDay(new Date(session.startedAt));
  const item: SessionItem = { ...session, status: "active", usageDay: day, reservedSeconds: MAX_SESSION_SECONDS };
  try {
    await deps.db.send(
      new TransactWriteCommand({
        TransactItems: [
          addUsage(deps, learnerKey(sub), day, MAX_SESSION_SECONDS, allowanceSeconds),
          addUsage(deps, "GLOBAL", day, MAX_SESSION_SECONDS, isAdmin ? undefined : GLOBAL_DAILY_CAP_SECONDS),
          {
            Put: {
              TableName: deps.tableName,
              Item: { ...sessionKey(sub, session.sessionId), ...item },
              ConditionExpression: "attribute_not_exists(#pk)",
              ExpressionAttributeNames: { "#pk": PK },
            },
          },
        ],
      }),
    );
    return { ok: true, session: item };
  } catch (err) {
    if (err instanceof TransactionCanceledException) {
      const codes = err.CancellationReasons?.map((r) => r.Code);
      if (codes?.[0] === "ConditionalCheckFailed") return { ok: false, reason: "daily-allowance" };
      if (codes?.[1] === "ConditionalCheckFailed") return { ok: false, reason: "global-cap" };
    }
    throw err;
  }
}

export const STREAK_SORT_KEY = "STREAK";

/**
 * The write that records a Session on the Learner's Streak, or nothing when it changes nothing: the same local
 * day again, or a released Session. The condition guards against two Sessions settling at once.
 */
function streakUpdate(deps: Deps, sub: string, session: SessionItem, outcome: Outcome, stored: Record<string, unknown> | undefined) {
  // Nothing to record for a released Session, a Session from before `localDay` existed, the same local day
  // again, or an earlier local day than the stored one (the Learner travelled west, or Sessions settled out of order).
  if (outcome === "released" || !session.localDay) return [];
  if (typeof stored?.lastDay === "string" && session.localDay <= stored.lastDay) return [];
  const continues = stored?.lastDay === previousDay(session.localDay);
  const count = continues ? Number(stored?.count ?? 0) + 1 : 1;
  return [
    {
      Put: {
        TableName: deps.tableName,
        Item: { [PK]: learnerKey(sub), [SK]: STREAK_SORT_KEY, count, lastDay: session.localDay },
        ...(stored
          ? { ConditionExpression: "lastDay = :seen", ExpressionAttributeValues: { ":seen": stored.lastDay } }
          : { ConditionExpression: "attribute_not_exists(#pk)", ExpressionAttributeNames: { "#pk": PK } }),
      },
    },
  ];
}

export type Outcome = "ended" | "timed-out" | "released";

export interface Settlement {
  chargedSeconds: number;
  immersionSeconds: number;
  /** The Reservation minus what was charged: what went back to today's Daily allowance. */
  returnedSeconds: number;
}

/** The result of an already-settled Session, as stored on it. */
export const storedSettlement = (session: SessionItem): Settlement => ({
  chargedSeconds: session.chargedSeconds ?? 0,
  immersionSeconds: session.immersionSeconds ?? 0,
  returnedSeconds: session.reservedSeconds - (session.chargedSeconds ?? 0),
});

/**
 * Settles an `active` Session once: charges `min(now - startedAt, reserved)` (nothing when released), refunds
 * the rest to the day it was reserved against, and adds the capped Partner seconds to Immersion time.
 * If it was already settled, returns the stored result.
 */
export async function settle(
  deps: Deps,
  sub: string,
  session: SessionItem,
  outcome: Outcome,
  partnerSeconds: number,
): Promise<Settlement> {
  const now = deps.world.clock.now();
  const elapsed = Math.max(0, Math.floor((now.getTime() - new Date(session.startedAt).getTime()) / 1000));
  const chargedSeconds =
    outcome === "released" ? 0 : outcome === "timed-out" ? session.reservedSeconds : Math.min(elapsed, session.reservedSeconds);
  const immersionSeconds = Math.min(partnerSeconds, chargedSeconds);
  const refund = session.reservedSeconds - chargedSeconds;

  // Retried when another Session of this Learner settled at the same moment and changed the Streak under us.
  for (let attempt = 1; ; attempt++) {
  const streakItem =
    outcome === "released"
      ? undefined
      : (await deps.db.send(new GetCommand({ TableName: deps.tableName, Key: { [PK]: learnerKey(sub), [SK]: STREAK_SORT_KEY }, ConsistentRead: true }))).Item;
  try {
    await deps.db.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: deps.tableName,
              Key: sessionKey(sub, session.sessionId),
              UpdateExpression:
                "SET #status = :outcome, endedAt = :endedAt, chargedSeconds = :charged, immersionSeconds = :immersion",
              ConditionExpression: "#status = :active",
              ExpressionAttributeNames: { "#status": "status" },
              ExpressionAttributeValues: {
                ":outcome": outcome,
                ":active": "active",
                ":endedAt": now.toISOString(),
                ":charged": chargedSeconds,
                ":immersion": immersionSeconds,
              },
            },
          },
          addUsage(deps, learnerKey(sub), session.usageDay, -refund),
          addUsage(deps, "GLOBAL", session.usageDay, -refund),
          ...(immersionSeconds === 0
            ? []
            : [
                {
                  Update: {
                    TableName: deps.tableName,
                    Key: { [PK]: learnerKey(sub), [SK]: `IMMERSION#${session.language}` },
                    UpdateExpression: "ADD partnerSeconds :seconds",
                    ExpressionAttributeValues: { ":seconds": immersionSeconds },
                  },
                },
              ]),
          ...streakUpdate(deps, sub, session, outcome, streakItem),
        ],
      }),
    );
    return { chargedSeconds, immersionSeconds, returnedSeconds: refund };
  } catch (err) {
    if (err instanceof TransactionCanceledException) {
      const stored = await getSession(deps, sub, session.sessionId);
      if (stored && stored.status !== "active") {
        return storedSettlement(stored);
      }
      if (stored && attempt < 3) continue;
    }
    throw err;
  }
  }
}

/** Counts one translation on the Learner's usage item for `now`'s UTC day; false once the daily limit is reached. */
export async function takeTranslation(deps: Deps, sub: string, now: Date): Promise<boolean> {
  const day = usageDay(now);
  try {
    await deps.db.send(
      new UpdateCommand({
        TableName: deps.tableName,
        Key: usageKey(learnerKey(sub), day),
        UpdateExpression: "ADD translationCount :one SET #ttl = :ttl",
        ConditionExpression: "attribute_not_exists(translationCount) OR translationCount < :limit",
        ExpressionAttributeNames: { "#ttl": TTL },
        ExpressionAttributeValues: { ":one": 1, ":limit": DAILY_TRANSLATION_LIMIT, ":ttl": usageTtl(day) },
      }),
    );
    return true;
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) return false;
    throw err;
  }
}

/** Gives back a translation that was counted but never delivered. */
export async function releaseTranslation(deps: Deps, sub: string, now: Date): Promise<void> {
  await deps.db.send(
    new UpdateCommand({
      TableName: deps.tableName,
      Key: usageKey(learnerKey(sub), usageDay(now)),
      UpdateExpression: "ADD translationCount :minusOne",
      ExpressionAttributeValues: { ":minusOne": -1 },
    }),
  );
}

export async function getSession(deps: Deps, sub: string, sessionId: string): Promise<SessionItem | undefined> {
  const out = await deps.db.send(
    new GetCommand({ TableName: deps.tableName, Key: sessionKey(sub, sessionId), ConsistentRead: true }),
  );
  return out.Item as SessionItem | undefined;
}
