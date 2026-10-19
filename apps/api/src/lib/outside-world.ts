import {
  ActionAfterCompletion,
  CreateScheduleCommand,
  FlexibleTimeWindowMode,
  SchedulerClient,
} from "@aws-sdk/client-scheduler";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { OPENAI_API_KEY_PARAMETER } from "./openai-key.ts";

// Every side effect outside the codebase and DynamoDB goes through this one dependency,
// so tests can swap in fakes (the spec's test seam).
export interface HangupTarget {
  sub: string;
  sessionId: string;
  callId: string;
}

export interface OutsideWorld {
  openai: {
    createCall(sdpOffer: string, sessionConfig: unknown): Promise<{ sdpAnswer: string; callId: string }>;
    hangup(callId: string): Promise<void>;
    moderate(text: string): Promise<{ flagged: boolean }>;
  };
  scheduler: {
    scheduleHangup(target: HangupTarget, at: Date): Promise<void>;
  };
  translate: {
    toEnglish(text: string, language: string): Promise<string>;
  };
  clock: {
    now(): Date;
  };
}

const notYetBuilt = (name: string, issue: string) => async (): Promise<never> => {
  throw new Error(`${name} is not wired up yet (see ${issue})`);
};

// Read at runtime (never at deploy time) and kept for the life of the Lambda container.
let apiKey: Promise<string> | undefined;
export const openaiApiKey = () =>
  (apiKey ??= new SSMClient({})
    .send(new GetParameterCommand({ Name: OPENAI_API_KEY_PARAMETER, WithDecryption: true }))
    .then((out) => {
      const value = out.Parameter?.Value;
      if (!value) throw new Error(`SSM parameter ${OPENAI_API_KEY_PARAMETER} is empty`);
      return value;
    })
    .catch((err: unknown) => {
      apiKey = undefined; // don't cache a failure: the owner may create the parameter later
      throw err;
    }));

async function createCall(sdpOffer: string, sessionConfig: unknown) {
  const form = new FormData();
  form.set("sdp", sdpOffer);
  form.set("session", JSON.stringify(sessionConfig));
  const response = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers: { authorization: `Bearer ${await openaiApiKey()}` },
    body: form,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`OpenAI create call failed with ${response.status}: ${text}`);
  const callId = response.headers.get("location")?.split("/").pop();
  if (!callId) throw new Error("OpenAI create call response had no Location header");
  return { sdpAnswer: text, callId };
}

async function hangup(callId: string) {
  const response = await fetch(`https://api.openai.com/v1/realtime/calls/${encodeURIComponent(callId)}/hangup`, {
    method: "POST",
    headers: { authorization: `Bearer ${await openaiApiKey()}` },
  });
  // 404 means the call is already gone (the Learner closed the tab, or OpenAI ended it): that is success.
  if (!response.ok && response.status !== 404) {
    throw new Error(`OpenAI hangup failed with ${response.status}: ${await response.text()}`);
  }
}

async function moderate(text: string) {
  const response = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: { authorization: `Bearer ${await openaiApiKey()}`, "content-type": "application/json" },
    body: JSON.stringify({ model: "omni-moderation-latest", input: text }),
  });
  if (!response.ok) throw new Error(`OpenAI moderation failed with ${response.status}: ${await response.text()}`);
  const result = (await response.json()) as { results?: { flagged?: boolean }[] };
  const flagged = result.results?.[0]?.flagged;
  if (typeof flagged !== "boolean") throw new Error("OpenAI moderation response had no verdict");
  return { flagged };
}

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
};

// A one-time schedule that deletes itself after it runs (spec #1). Its input is what the hang-up Lambda receives.
async function scheduleHangup(target: HangupTarget, at: Date) {
  await new SchedulerClient({}).send(
    new CreateScheduleCommand({
      Name: `hangup-${target.sessionId}`,
      GroupName: requireEnv("SCHEDULE_GROUP_NAME"),
      ScheduleExpression: `at(${at.toISOString().slice(0, 19)})`,
      ScheduleExpressionTimezone: "UTC",
      FlexibleTimeWindow: { Mode: FlexibleTimeWindowMode.OFF },
      ActionAfterCompletion: ActionAfterCompletion.DELETE,
      Target: {
        Arn: requireEnv("HANGUP_FUNCTION_ARN"),
        RoleArn: requireEnv("SCHEDULER_ROLE_ARN"),
        Input: JSON.stringify(target),
      },
    }),
  );
}

// Real clients are added by the tickets that first need them.
export function productionOutsideWorld(): OutsideWorld {
  return {
    openai: {
      createCall,
      hangup,
      moderate,
    },
    scheduler: { scheduleHangup },
    translate: { toEnglish: notYetBuilt("translate.toEnglish", "#8") },
    clock: { now: () => new Date() },
  };
}
