# OpenAI gpt-realtime-mini over WebRTC as the voice provider

The Partner runs on OpenAI's `gpt-realtime-2.1-mini`, with the browser connected over WebRTC. We chose it over Gemini Live, which is roughly 2× cheaper per hour, because WebRTC gives us echo cancellation, jitter handling and barge-in in the browser for free. Gemini's browser path is a WebSocket carrying raw PCM, plus a 10-minute connection limit that needs session-resumption logic, and that plumbing doesn't fit a 2-week part-time MVP. The full `gpt-realtime-2.1` model costs roughly 3–4× more per hour, which is too much for a product whose unit is hours of listening.

## Considered Options

- **Gemini Live (`gemini-3.8-live`)**: cheapest (~$0.60–2.80/hour), and its ephemeral tokens can lock the session config. Rejected for build effort, not quality. It remains the first cost optimisation to revisit.
- **Amazon Nova Sonic**: no browser-direct connection, so it needs a long-lived relay on AgentCore or Fargate, which breaks the request/response serverless shape. It also covers too few languages.
- **ElevenLabs or Deepgram agents**: ~$4.50/hour or more, plus subscription tiers.

## Consequences

- Validated on 2026-10-19 with the spike in `spikes/accent-drift-test/`. The Partner held European accents for pt-PT and es-ES, with no drift into English and working Level separation. The `cedar` voice sounded best.
- Level only took effect once each Level had an **example Partner Turn per language** and a fixed **`audio.output.speed`** (A1 0.8×, B2 1.05×). Abstract CEFR descriptions alone had no audible effect. Level specs are therefore data: one example Turn plus a speed per language and Level.
- Pricing figures were retrieved on 2026-10-19 and will change.
