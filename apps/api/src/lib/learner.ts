import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { DAILY_ALLOWANCE_SECONDS } from "./limits.ts";

export interface Caller {
  /** The Learner's identity: always the JWT `sub`, never anything from the request body. */
  sub: string;
  isAdmin: boolean;
}

export const allowanceSeconds = (caller: Caller) =>
  caller.isAdmin ? DAILY_ALLOWANCE_SECONDS.admin : DAILY_ALLOWANCE_SECONDS.learner;

/** API Gateway renders the `cognito:groups` array claim as "[a b]" (or a bare string for one group). */
export function parseGroups(claim: unknown): string[] {
  if (Array.isArray(claim)) return claim.map(String);
  if (typeof claim !== "string") return [];
  return claim.replace(/^\[|\]$/g, "").split(/[\s,]+/).filter(Boolean);
}

export function callerOf(event: APIGatewayProxyEventV2WithJWTAuthorizer): Caller {
  const claims = event.requestContext.authorizer.jwt.claims;
  const sub = claims.sub;
  if (typeof sub !== "string" || !sub) throw new Error("Request reached the handler without a JWT sub claim");
  return { sub, isAdmin: parseGroups(claims["cognito:groups"]).includes("admins") };
}

export const usageDay = (now: Date) => now.toISOString().slice(0, 10);

/** The next UTC midnight after `now`, when the Daily allowance resets. */
export const nextUtcMidnight = (now: Date) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));

const isValidTimeZone = (timeZone: string) => {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone });
    return true;
  } catch {
    return false;
  }
};

/** The Learner's calendar day (YYYY-MM-DD) at `now` in `timeZone`; UTC when the time zone is missing or invalid. */
export function localDay(now: Date, timeZone: string | undefined): string {
  if (!timeZone || !isValidTimeZone(timeZone)) return usageDay(now);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** The calendar day before `day` (YYYY-MM-DD). */
export const previousDay = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
