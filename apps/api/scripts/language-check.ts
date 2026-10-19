// Decides whether a Partner reply is in the Target language, for the live drift check.
import { francAll } from "franc-min";
import type { Language } from "@immersr/shared";

const ISO_639_3: Record<Language, string> = { "pt-PT": "por", "es-ES": "spa", "fr-FR": "fra" };

// Only the three Target languages plus English can matter: anything else is noise for short replies.
const CANDIDATES = [...Object.values(ISO_639_3), "eng"];

export type LanguageCheck =
  | { verdict: "pass"; detected: string }
  | { verdict: "inconclusive" } // too short for the detector to say anything
  | { verdict: "drift"; detected: string };

export function checkLanguage(text: string, language: Language): LanguageCheck {
  const [best] = francAll(text, { minLength: 3, only: CANDIDATES });
  if (!best || best[0] === "und") return { verdict: "inconclusive" };
  return best[0] === ISO_639_3[language]
    ? { verdict: "pass", detected: best[0] }
    : { verdict: "drift", detected: best[0] };
}
