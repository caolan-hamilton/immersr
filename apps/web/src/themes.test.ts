import { describe, expect, it } from "vitest";
import { parseLanguage } from "./themes.ts";

describe("parseLanguage", () => {
  it("accepts each Target language", () => {
    expect(parseLanguage("pt-PT")).toBe("pt-PT");
    expect(parseLanguage("es-ES")).toBe("es-ES");
    expect(parseLanguage("fr-FR")).toBe("fr-FR");
  });

  it("is undefined when nothing, or something else, is stored", () => {
    expect(parseLanguage(null)).toBeUndefined();
    expect(parseLanguage("")).toBeUndefined();
    expect(parseLanguage("de-DE")).toBeUndefined();
  });
});
