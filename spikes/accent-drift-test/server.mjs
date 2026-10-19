// Throwaway spike: local stand-in for the POST /sessions Lambda (ADR 0004).
// Run: OPENAI_API_KEY=sk-... node server.mjs  → open http://localhost:5173
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { buildInstructions, LEVELS } from "./instructions.mjs";

const MODEL = process.env.MODEL ?? "gpt-realtime-2.1-mini";
const PORT = 5173;

if (typeof fetch !== "function" || typeof FormData !== "function") {
  console.error(`Node ${process.version} is too old: this needs Node 20+ (global fetch/FormData).`);
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
  console.error("Set OPENAI_API_KEY first.");
  process.exit(1);
}

const readBody = async (req) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body;
};

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(await readFile(new URL("./index.html", import.meta.url)));
  }

  if (req.method === "POST" && url.pathname === "/session") {
    try {
      const language = url.searchParams.get("language");
      const level = url.searchParams.get("level");
      const topic = (url.searchParams.get("topic") ?? "").slice(0, 150);
      const voice = url.searchParams.get("voice") ?? "marin";
      const eagerness = url.searchParams.get("eagerness") ?? "low";

      const session = {
        type: "realtime",
        model: MODEL,
        instructions: buildInstructions({ language, level, topic }),
        audio: {
          input: {
            transcription: { model: "gpt-4o-mini-transcribe" },
            turn_detection: { type: "semantic_vad", eagerness, interrupt_response: true },
          },
          output: { voice, speed: LEVELS[level].speed },
        },
      };

      const fd = new FormData();
      fd.set("sdp", await readBody(req));
      fd.set("session", JSON.stringify(session));

      const r = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: fd,
      });
      const text = await r.text();
      if (!r.ok) {
        console.error(`OpenAI ${r.status}: ${text}`);
        res.writeHead(502, { "Content-Type": "text/plain" });
        return res.end(`OpenAI ${r.status}: ${text}`);
      }

      const callId = r.headers.get("location")?.split("/").pop();
      console.log(`call started: ${callId} (${language} ${level}, voice ${voice}, model ${MODEL})`);
      res.writeHead(200, { "Content-Type": "application/sdp", "X-Call-Id": callId ?? "" });
      return res.end(text);
    } catch (err) {
      console.error(err);
      res.writeHead(400, { "Content-Type": "text/plain" });
      return res.end(String(err.message ?? err));
    }
  }

  res.writeHead(404).end();
}).listen(PORT, () => console.log(`Drift test on http://localhost:${PORT} using ${MODEL}`));
