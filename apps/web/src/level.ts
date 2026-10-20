import { useState } from "react";
import { LEVELS, type Level } from "@immersr/shared";

const STORAGE_KEY = "immersr.level";
const DEFAULT_LEVEL: Level = "A1";

function readLevel(): Level {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return LEVELS.find((level) => level === stored) ?? DEFAULT_LEVEL;
  } catch {
    return DEFAULT_LEVEL;
  }
}

/** The Learner's Level, remembered on this device. */
export function useLevel(): [Level, (level: Level) => void] {
  const [level, setLevel] = useState(readLevel);
  const choose = (next: Level) => {
    setLevel(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage can be blocked (private mode); the choice then lasts only until the page closes.
    }
  };
  return [level, choose];
}
