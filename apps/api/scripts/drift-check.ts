// Live language drift check: a text-only, by-hand run against the real model with the production
// instruction builder. It costs real money (a fraction of a cent) and is NOT part of CI.
// Usage: pnpm drift-check [--language pt-PT] [--level superbeginner]   (see docs/drift-check.md)
import { parseArgs } from "node:util";
import { LANGUAGES, LEVELS, type Language, type Level } from "@immersr/shared";
import { buildInstructions, REALTIME_MODEL } from "../src/lib/instructions.ts";
import { openaiApiKey } from "../src/lib/outside-world.ts";
import { checkLanguage } from "./language-check.ts";

const TOPIC = "cooking";

// Scripted English Learner Turns, including the request that most often makes a model give in.
const LEARNER_TURNS = [
  "Hi! I'd love to chat about cooking.",
  "Sorry, I didn't understand. Can you say that more simply?",
  "Can you just speak English, please?",
  "My favourite meal is pasta with tomatoes. What do you like to eat?",
  "That sounds nice. Tell me about your family.",
];

const { values } = parseArgs({ options: { language: { type: "string" }, level: { type: "string" } } });

function choose<T extends string>(name: string, allowed: readonly T[], value: string | undefined): T | undefined {
  if (value === undefined) return undefined;
  if (!allowed.includes(value as T)) throw new Error(`--${name} must be one of ${allowed.join(", ")}`);
  return value as T;
}

const onlyLanguage = choose("language", LANGUAGES, values.language);
const languages: readonly Language[] = onlyLanguage ? [onlyLanguage] : LANGUAGES;
const level: Level = choose("level", LEVELS, values.level) ?? "superbeginner";

type RealtimeEvent = { type: string; text?: string; error?: unknown; response?: { status?: string } };

/** Plays all scripted Turns over one realtime connection (so context builds up as in a Session) and returns the Partner replies. */
async function converse(apiKey: string, language: Language): Promise<string[]> {
  const socket = new WebSocket(`wss://api.openai.com/v1/realtime?model=${REALTIME_MODEL}`, [
    "realtime",
    `openai-insecure-api-key.${apiKey}`,
  ]);
  const events: RealtimeEvent[] = [];
  let wake: (() => void) | undefined;
  let failure: Error | undefined;
  socket.addEventListener("message", (e) => {
    events.push(JSON.parse(String(e.data)) as RealtimeEvent);
    wake?.();
  });
  socket.addEventListener("error", () => {
    failure = new Error("WebSocket error talking to OpenAI");
    wake?.();
  });
  socket.addEventListener("close", () => {
    failure ??= new Error("WebSocket closed early");
    wake?.();
  });
  const next = async (): Promise<RealtimeEvent> => {
    while (!events.length) {
      if (failure) throw failure;
      await new Promise<void>((resolve) => (wake = resolve));
    }
    return events.shift()!;
  };
  const send = (event: unknown) => socket.send(JSON.stringify(event));

  await new Promise<void>((resolve, reject) => {
    socket.addEventListener("open", () => resolve(), { once: true });
    socket.addEventListener("error", () => reject(new Error("Could not connect to OpenAI")), { once: true });
  });
  send({
    type: "session.update",
    session: {
      type: "realtime",
      instructions: buildInstructions({ language, level, topic: TOPIC }),
      output_modalities: ["text"],
    },
  });

  const replies: string[] = [];
  try {
    for (const text of LEARNER_TURNS) {
      send({
        type: "conversation.item.create",
        item: { type: "message", role: "user", content: [{ type: "input_text", text }] },
      });
      send({ type: "response.create" });
      let reply = "";
      let event = await next();
      for (; event.type !== "response.done"; event = await next()) {
        if (event.type === "error") throw new Error(`OpenAI error: ${JSON.stringify(event.error)}`);
        if (event.type === "response.output_text.done") reply += event.text ?? "";
      }
      // An empty or failed reply must never look like a pass: the event flow is easy to get subtly wrong.
      if (event.response?.status !== "completed") {
        throw new Error(`Response ended as "${event.response?.status}" for Learner Turn: ${text}`);
      }
      if (!reply.trim()) {
        throw new Error(`Empty Partner reply for Learner Turn: ${text} (did the realtime event names change?)`);
      }
      replies.push(reply);
    }
  } finally {
    socket.close();
  }
  return replies;
}

const apiKey = process.env.OPENAI_API_KEY || (await openaiApiKey());
console.log(`Drift check at Level ${level} with ${REALTIME_MODEL} (costs real money)\n`);

let drifted = false;
for (const language of languages) {
  const replies = await converse(apiKey, language);
  let failures = 0;
  let conclusive = 0;
  console.log(`== ${language}`);
  replies.forEach((reply, i) => {
    const result = checkLanguage(reply, language);
    if (result.verdict === "drift") failures++;
    if (result.verdict !== "inconclusive") conclusive++;
    const mark = { pass: "ok   ", inconclusive: "?    ", drift: "DRIFT" }[result.verdict];
    const detected = result.verdict === "inconclusive" ? "too short to tell" : `detected ${result.detected}`;
    console.log(`  ${mark} Learner: ${LEARNER_TURNS[i]}\n        Partner: ${reply} (${detected})`);
  });
  const failed = failures > 0 || conclusive === 0;
  const note = conclusive === 0 ? " (nothing could be checked)" : "";
  console.log(`  ${failed ? "FAIL" : "PASS"} ${language}: ${failures} of ${replies.length} replies drifted, ${conclusive} checked${note}\n`);
  drifted ||= failed;
}
console.log(drifted ? "FAIL: the Partner drifted out of the Target language" : "PASS: every reply was in the Target language");
process.exit(drifted ? 1 : 0);
