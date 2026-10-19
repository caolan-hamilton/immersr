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

// Real clients are added by the tickets that first need them.
export function productionOutsideWorld(): OutsideWorld {
  return {
    openai: {
      createCall,
      hangup: notYetBuilt("openai.hangup", "#5"),
      moderate: notYetBuilt("openai.moderate", "#7"),
    },
    scheduler: { scheduleHangup: notYetBuilt("scheduler.scheduleHangup", "#6") },
    translate: { toEnglish: notYetBuilt("translate.toEnglish", "#8") },
    clock: { now: () => new Date() },
  };
}
