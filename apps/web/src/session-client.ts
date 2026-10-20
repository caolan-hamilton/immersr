// Connects a Session over WebRTC (ADR 0001, ADR 0004): the browser posts its SDP offer to our API and
// never holds an OpenAI credential. Events arrive on the "oai-events" data channel.
import {
  CreateSessionResponse,
  EndSessionResponse,
  SessionRefusal,
  TranslateResponse,
  type CreateSessionRequest,
  type EndSessionRequest,
  type TranslateRequest,
} from "@immersr/shared";
import { getIdToken } from "./auth.ts";

export type TurnSpeaker = "Partner" | "Learner";

export interface SessionEvents {
  /** The Partner is mid-Turn: the text so far. Cleared (empty string) once the Turn is final. */
  onPartnerDraft(text: string): void;
  onTurn(speaker: TurnSpeaker, text: string): void;
  onError(message: string): void;
  /** Every realtime event's type, passed on as it arrives, for the Session screen's state. */
  onRealtimeEvent(type: string): void;
  /** The connection failed or closed without the Learner pressing End. */
  onDisconnected(): void;
}

export class MicrophoneBlockedError extends Error {}
export class SessionStartError extends Error {}
/** The start was refused with 429 before any call was made. */
export class SessionRefusedError extends Error {
  constructor(readonly reason: SessionRefusal["reason"]) {
    super(reason);
  }
}

export interface LiveSession {
  sessionId: string;
  endsAt: string;
  /** Closes the connection locally. The server settles separately, via `reportEnd`. */
  end(): void;
  /** Seconds the Partner has spoken so far: output audio tokens ÷ 20 from each `response.done`. */
  partnerSeconds(): number;
  /** Mute: the microphone track sends silence; the Partner keeps talking. */
  setMuted(muted: boolean): void;
  /**
   * Pause: cancels any response, turns off the microphone and silences the Partner's audio.
   * Resume re-enables both and asks the Partner to carry on.
   */
  setPaused(paused: boolean): void;
}

/** End was refused or couldn't be delivered. `status` is the HTTP status, absent when the request never arrived. */
export class EndFailedError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

/** Tells the server the Session is over; it hangs up, settles on its own clock and returns the result. */
export async function reportEnd(sessionId: string, partnerSeconds: number): Promise<EndSessionResponse> {
  const token = await getIdToken();
  if (!token) throw new EndFailedError("You've been signed out. Please sign in again.");
  let response: Response;
  try {
    response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/end`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ partnerSeconds: Math.floor(partnerSeconds) } satisfies EndSessionRequest),
    });
  } catch {
    throw new EndFailedError("You appear to be offline.");
  }
  if (!response.ok) throw new EndFailedError(`Couldn't end the Session cleanly (${response.status}).`, response.status);
  return EndSessionResponse.parse(await response.json());
}

/** The Learner has used all of today's translations. */
export class TranslationLimitError extends Error {}

/** The English Turn translation of a Partner Turn's text. */
export async function translateTurn(sessionId: string, text: string): Promise<string> {
  const token = await getIdToken();
  if (!token) throw new Error("You've been signed out. Please sign in again.");
  const response = await fetch("/api/translations", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ sessionId, text } satisfies TranslateRequest),
  });
  if (response.status === 429) throw new TranslationLimitError();
  if (!response.ok) throw new Error(`Couldn't translate that (${response.status}). Please try again.`);
  return TranslateResponse.parse(await response.json()).translation;
}

export async function startSession(
  choice: Omit<CreateSessionRequest, "sdpOffer">,
  events: SessionEvents,
): Promise<LiveSession> {
  let mic: MediaStream;
  try {
    // The browser's own clean-up runs before turn detection sees the audio, so coughs, taps and
    // the Partner's voice leaking from speakers are less likely to count as the Learner speaking.
    mic = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (err) {
    throw new MicrophoneBlockedError(err instanceof Error ? err.message : String(err));
  }
  const stopMic = () => mic.getTracks().forEach((track) => track.stop());

  const pc = new RTCPeerConnection();
  let ending = false;
  const close = () => {
    ending = true; // pc.close() fires no state event, but be explicit that this end was deliberate
    stopMic();
    pc.close();
  };
  pc.onconnectionstatechange = () => {
    if (ending || (pc.connectionState !== "failed" && pc.connectionState !== "closed")) return;
    close();
    events.onDisconnected();
  };

  try {
    let muted = false;
    let paused = false;
    // The microphone sends audio only when the Learner is neither muted nor paused.
    const applyMicrophone = () => mic.getAudioTracks().forEach((track) => (track.enabled = !muted && !paused));
    const audio = new Audio();
    audio.autoplay = true;
    pc.ontrack = (e) => (audio.srcObject = e.streams[0] ?? null);
    for (const track of mic.getTracks()) pc.addTrack(track, mic);

    let draft = "";
    let outputAudioTokens = 0;
    const channel = pc.createDataChannel("oai-events");
    // Opening the channel is the cue for the Partner to speak first.
    channel.onopen = () => channel.send(JSON.stringify({ type: "response.create" }));
    channel.onmessage = (message) => {
      const event = JSON.parse(String(message.data)) as {
        type: string;
        delta?: string;
        transcript?: string;
        error?: { message?: string };
        response?: { usage?: { output_token_details?: { audio_tokens?: number } } };
      };
      events.onRealtimeEvent(event.type);
      switch (event.type) {
        case "response.done":
          outputAudioTokens += event.response?.usage?.output_token_details?.audio_tokens ?? 0;
          break;
        case "response.output_audio_transcript.delta":
          draft += event.delta ?? "";
          events.onPartnerDraft(draft);
          break;
        case "response.output_audio_transcript.done":
          draft = "";
          events.onPartnerDraft("");
          if (event.transcript?.trim()) events.onTurn("Partner", event.transcript.trim());
          break;
        case "conversation.item.input_audio_transcription.completed":
          if (event.transcript?.trim()) events.onTurn("Learner", event.transcript.trim());
          break;
        case "error":
          events.onError(event.error?.message ?? "The Partner hit an error.");
          break;
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const token = await getIdToken();
    if (!token) throw new SessionStartError("You've been signed out. Please sign in again.");
    const request: CreateSessionRequest = {
      ...choice,
      sdpOffer: offer.sdp ?? "",
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    const response = await fetch("/api/sessions", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(request),
    });
    if (response.status === 429) {
      const refusal = SessionRefusal.safeParse(await response.json().catch(() => undefined));
      throw new SessionRefusedError(refusal.success ? refusal.data.reason : "global-cap");
    }
    if (response.status === 403) {
      throw new SessionStartError("Sessions aren't open to everyone yet. Ask the owner to give you access.");
    }
    if (response.status === 422) {
      throw new SessionStartError("That Topic can't be used. Please choose another Topic. Your other choices are kept.");
    }
    if (!response.ok) throw new SessionStartError(`Couldn't start the Session (${response.status}).`);
    const created = CreateSessionResponse.parse(await response.json());
    await pc.setRemoteDescription({ type: "answer", sdp: created.sdpAnswer });

    return {
      sessionId: created.sessionId,
      endsAt: created.endsAt,
      end: close,
      partnerSeconds: () => outputAudioTokens / 20,
      setMuted: (value) => {
        muted = value;
        applyMicrophone();
      },
      setPaused: (value) => {
        if (value === paused) return;
        paused = value;
        applyMicrophone();
        audio.muted = paused;
        if (channel.readyState === "open") channel.send(JSON.stringify({ type: paused ? "response.cancel" : "response.create" }));
      },
    };
  } catch (err) {
    close();
    throw err;
  }
}
