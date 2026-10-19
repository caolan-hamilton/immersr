import { describe, expect, it } from "vitest";
import type { Language } from "@immersr/shared";
import { checkLanguage } from "../scripts/language-check.ts";

// The pure decision behind the live drift check: many replies, one verdict each.
const cases: Array<[Language, string, "pass" | "drift" | "inconclusive"]> = [
  ["pt-PT", "Eu moro em Lisboa. Lisboa é bonita. Tem muitos elétricos. Gostas de elétricos?", "pass"],
  ["es-ES", "Yo vivo en Madrid. Madrid es grande. Hay muchos parques. ¿Te gustan los parques?", "pass"],
  ["fr-FR", "J'habite à Paris. Paris est grand. Il y a beaucoup de cafés. Tu aimes les cafés ?", "pass"],
  ["pt-PT", "Sure, I can speak English. What would you like to talk about today?", "drift"],
  ["es-ES", "Of course, let me explain that to you in English so it is easier.", "drift"],
  ["fr-FR", "Yo vivo en Madrid. Madrid es grande. Hay muchos parques.", "drift"],
  ["es-ES", "", "inconclusive"],
];

describe("checkLanguage", () => {
  it.each(cases)("%s: %s", (language, text, verdict) => {
    expect(checkLanguage(text, language).verdict).toBe(verdict);
  });
});
