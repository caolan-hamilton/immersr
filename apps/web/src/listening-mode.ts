const STORAGE_KEY = "immersr.listening-mode";

/** Whether the Learner last left Listening mode on, remembered on this device. */
export function readListeningMode(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

export function saveListeningMode(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    // Storage can be blocked (private mode); the choice then lasts only until the page closes.
  }
}
