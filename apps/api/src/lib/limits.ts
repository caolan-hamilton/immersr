// Limits are configuration values, not hard-coded across modules (spec #1).
export const MAX_SESSION_SECONDS = 15 * 60;
export const GLOBAL_DAILY_CAP_SECONDS = 45 * 60;
export const DAILY_ALLOWANCE_SECONDS = { learner: 15 * 60, admin: 90 * 60 } as const;
export const DAILY_TRANSLATION_LIMIT = 200;
export const USAGE_TTL_SECONDS = 7 * 24 * 60 * 60;
