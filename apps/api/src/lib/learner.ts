import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";

export interface Caller {
  /** The Learner's identity: always the JWT `sub`, never anything from the request body. */
  sub: string;
  isAdmin: boolean;
}

export const DAILY_ALLOWANCE_SECONDS = { learner: 15 * 60, admin: 90 * 60 } as const;

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
