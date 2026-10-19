// Every side effect outside the codebase and DynamoDB goes through this one dependency,
// so tests can swap in fakes (the spec's test seam).
export interface HangupTarget {
  sub: string;
  sessionId: string;
  callId: string;
}

export interface OutsideWorld {
  openai: {
    createCall(sdpOffer: string, sessionConfig: unknown): Promise<{ sdpAnswer: string; callId: string }>;
    hangup(callId: string): Promise<void>;
    moderate(text: string): Promise<{ flagged: boolean }>;
  };
  scheduler: {
    scheduleHangup(target: HangupTarget, at: Date): Promise<void>;
  };
  translate: {
    toEnglish(text: string, language: string): Promise<string>;
  };
  clock: {
    now(): Date;
  };
}

const notYetBuilt = (name: string, issue: string) => async (): Promise<never> => {
  throw new Error(`${name} is not wired up yet (see ${issue})`);
};

// Real clients are added by the tickets that first need them.
export function productionOutsideWorld(): OutsideWorld {
  return {
    openai: {
      createCall: notYetBuilt("openai.createCall", "#4"),
      hangup: notYetBuilt("openai.hangup", "#5"),
      moderate: notYetBuilt("openai.moderate", "#7"),
    },
    scheduler: { scheduleHangup: notYetBuilt("scheduler.scheduleHangup", "#6") },
    translate: { toEnglish: notYetBuilt("translate.toEnglish", "#8") },
    clock: { now: () => new Date() },
  };
}
