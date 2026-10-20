import { useState } from "react";
import { levelFromStored, type Level } from "@immersr/shared";

const STORAGE_KEY = "immersr.level";

function readLevel(): Level {
  try {
    return levelFromStored(localStorage.getItem(STORAGE_KEY));
  } catch {
    return levelFromStored(null);
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
