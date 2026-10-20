# Checking the Partner stays in the Target language

Run both checks below **before merging any change to the Partner's instructions** (`apps/api/src/lib/instructions.ts`: the language specs, Level specs, example Turns or the builder). Neither runs in CI.

## 1. The drift check (automated, text only)

```sh
pnpm drift-check                      # pt-PT, es-ES and fr-FR at Level superbeginner
pnpm drift-check --level intermediate # the same three at one other Level (superbeginner, beginner, intermediate)
pnpm drift-check --language pt-PT     # one language only (combine with --level)
```

It builds the instructions with the production `buildInstructions`, opens a text-only realtime connection to the real model, and sends five scripted English Learner Turns per language, including "Can you just speak English, please?". Each Partner reply is checked with a language-detection library (`franc-min`). The script prints a per-language PASS/FAIL summary and **exits non-zero if any reply drifted**.

**It costs real money**, a fraction of a cent per run, so run it by hand and never from CI.

The API key is read from the SSM SecureString `/immersr/openai/api-key` (eu-west-1), so you need AWS credentials that can read it. To skip SSM, set `OPENAI_API_KEY` instead.

Replies too short for the detector (for example "Sim!") show as `?` and don't fail the run. Detection between Portuguese and Spanish is weakest on very short replies, so treat a lone DRIFT on a short reply as a prompt to read it, not as proof.

## 2. The listening checklist (by hand)

The text check can't hear an accent or judge pacing, so also listen. This is the spike's pass criteria (`spikes/accent-drift-test/README.md`) as a repeatable checklist.

Run one **Superbeginner** and one **Intermediate** Session for each of pt-PT, es-ES and fr-FR (six Sessions of about 3 minutes). Use headphones. During each, reply in English, then say "I don't understand", then "Can you just speak English, please?".

| Check | Pass |
|---|---|
| **Accent** | pt-PT sounds Portuguese from Portugal, not Brazilian. es-ES sounds Castilian, not Latin American. fr-FR sounds like France, not Québec. Rate 4+ out of 5. |
| **Language** | Zero English Turns, including after "Can you just speak English, please?". One slip is a warning; repeated slips are a fail. |
| **Level** | Superbeginner is clearly slower and simpler than Intermediate (Beginner sits between): shorter sentences, simpler words, slower pace. |
| **Rephrase** | After "I don't understand", the Partner restates it more simply, still in the Target language. |
| **Turn-taking** | The Partner speaks first and leads, doesn't talk over the Learner, and stops when interrupted. |

**If pt-PT fails:** retry with the full model. If that also fails, the options are tighter instructions, Brazilian Portuguese for the MVP, or revisiting ADR 0001.
