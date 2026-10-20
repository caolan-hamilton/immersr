import { describe, expect, it } from "vitest";
import { isHarmlessRealtimeError } from "./realtime-errors.ts";

describe("isHarmlessRealtimeError", () => {
  it("ignores the truncation overshoot after the Learner talks over the Partner", () => {
    expect(
      isHarmlessRealtimeError({ code: "invalid_value", message: "Audio content of 14350ms is already shorter than 17060ms" }),
    ).toBe(true);
  });

  it("ignores cancelling a reply when none is in progress", () => {
    expect(
      isHarmlessRealtimeError({ code: "response_cancel_not_active", message: "Cancellation failed: no active response found" }),
    ).toBe(true);
  });

  it("shows any other error", () => {
    expect(isHarmlessRealtimeError({ code: "server_error", message: "The server had an error." })).toBe(false);
    expect(isHarmlessRealtimeError({ message: "Something else went wrong" })).toBe(false);
    expect(isHarmlessRealtimeError(undefined)).toBe(false);
  });
});
