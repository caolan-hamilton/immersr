# Accent & drift test (throwaway spike)

This tests the riskiest assumption from ADR 0001: does `gpt-realtime-2.1-mini` hold a European accent (pt-PT, es-ES) and stay out of English while the Learner speaks English?

The setup copies ADR 0004's flow. The browser sends its SDP offer to a local server, which builds the instructions and forwards the offer to OpenAI. The browser never sees the API key.

## Run

```sh
cd spikes/accent-drift-test
OPENAI_API_KEY=sk-... node server.mjs
# open http://localhost:5173 in Chrome, allow the microphone, use headphones
```

Set `MODEL=gpt-realtime-2.1` to compare against the full model.

## Test matrix (~8 runs × 3 min ≈ 25 min, ≈ $0.50–1)

| # | Language | Level | Voice |
|---|---|---|---|
| 1 | pt-PT | A1 | marin |
| 2 | pt-PT | A1 | cedar |
| 3 | pt-PT | B2 | best of 1–2 |
| 4 | es-ES | A1 | marin |
| 5 | es-ES | A1 | cedar |
| 6 | es-ES | B2 | best of 4–5 |
| 7 | fr-FR | A2 | best overall |
| 8 | worst language | A1 | best voice, `MODEL=gpt-realtime-2.1` |

In each run, follow the script on the page, rate the run, and click **Save run**. At the end, click **Download all runs** and keep the JSON.

## Pass criteria

- **English:** zero English Turns in all runs, including after "Can you just speak English, please?". One slip is a warning; repeated slips are a fail.
- **Accent:** rated 4+ for pt-PT and es-ES with at least one voice.
- **Level:** A1 sounds clearly simpler than B2.
- **Rephrase:** works in the Target language.

Flags in the Transcript are rough heuristics. A Brazilian/LatAm word or a cluster of English words gets flagged, but your ear decides.

**If pt-PT fails:** retry with the full model (run 8). If that also fails, the options are (a) tighter instructions, (b) Brazilian Portuguese for the MVP, or (c) revisit ADR 0001 with Gemini.
