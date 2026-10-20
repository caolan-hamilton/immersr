import { useState, type CSSProperties } from "react";
import { LANGUAGES, type Language } from "@immersr/shared";

/** How the app looks and greets for one Target language. */
export interface Theme {
  name: string;
  short: string;
  /** The Mascot's colour. */
  body: string;
  /** The flag's second colour, used for primary buttons. */
  accent: string;
  /** Text colour on top of `body`. */
  onBody: string;
  hello: string;
  wellDone: string;
}

export const THEMES: Record<Language, Theme> = {
  "pt-PT": {
    name: "European Portuguese",
    short: "Portuguese",
    body: "#1F8A4C",
    accent: "#D7263D",
    onBody: "#FFFFFF",
    hello: "Olá!",
    wellDone: "Muito bem!",
  },
  "es-ES": {
    name: "Castilian Spanish",
    short: "Spanish",
    body: "#F0A81C",
    accent: "#C8352A",
    onBody: "#141414",
    hello: "¡Hola!",
    wellDone: "¡Muy bien!",
  },
  "fr-FR": {
    name: "French",
    short: "French",
    body: "#2F55A4",
    accent: "#E2504A",
    onBody: "#FFFFFF",
    hello: "Bonjour !",
    wellDone: "Très bien !",
  },
};

/** The CSS variables that re-theme everything beneath an element. */
export const themeVars = (theme: Theme) =>
  ({ "--body": theme.body, "--accent": theme.accent, "--on-body": theme.onBody }) as CSSProperties;

const STORAGE_KEY = "immersr.language";
const DEFAULT_LANGUAGE: Language = "pt-PT";

function readLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return LANGUAGES.find((code) => code === stored) ?? DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

/** The current Target language, remembered on this device. */
export function useCurrentLanguage(): [Language, (language: Language) => void] {
  const [language, setLanguage] = useState(readLanguage);
  const choose = (next: Language) => {
    setLanguage(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage can be blocked (private mode); the choice then lasts only until the page closes.
    }
  };
  return [language, choose];
}
