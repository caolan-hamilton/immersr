// Connects a Session over WebRTC (ADR 0001, ADR 0004): the browser posts its SDP offer to our API and
// never holds an OpenAI credential. Events arrive on the "oai-events" data channel.
import { CreateSessionResponse, type CreateSessionRequest } from "@immersr/shared";
import { getIdToken } from "./auth.ts";

export type TurnSpeaker = "Partner" | "Learner";

export interface SessionEvents {
  /** The Partner is mid-Turn: the text so far. Cleared (empty string) once the Turn is final. */
  onPartnerDraft(text: string): void;
  onTurn(speaker: TurnSpeaker, text: string): void;
  onError(message: string): void;
  /** The connection failed or closed without the Learner pressing End. */
  onDisconnected(): void;
}

export class MicrophoneBlockedError extends Error {}
export class SessionStartError extends Error {}

export interface LiveSession {
  sessionId: string;
  endsAt: string;
  end(): void;
}

export async function startSession(
  choice: Omit<CreateSessionRequest, "sdpOffer">,
  events: SessionEvents,
): Promise<LiveSession> {
  let mic: MediaStream;
  try {
    mic = await navigator.mediaDevices.getUserMedia({ audio: true });
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
    const audio = new Audio();
    audio.autoplay = true;
    pc.ontrack = (e) => (audio.srcObject = e.streams[0] ?? null);
    for (const track of mic.getTracks()) pc.addTrack(track, mic);

    let draft = "";
    const channel = pc.createDataChannel("oai-events");
    // Opening the channel is the cue for the Partner to speak first.
    channel.onopen = () => channel.send(JSON.stringify({ type: "response.create" }));
    channel.onmessage = (message) => {
      const event = JSON.parse(String(message.data)) as { type: string; delta?: string; transcript?: string; error?: { message?: string } };
      switch (event.type) {
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
    const request: CreateSessionRequest = { ...choice, sdpOffer: offer.sdp ?? "" };
    const response = await fetch("/api/sessions", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(request),
    });
    if (response.status === 403) throw new SessionStartError("Sessions aren't open to your account yet.");
    if (!response.ok) throw new SessionStartError(`Couldn't start the Session (${response.status}).`);
    const created = CreateSessionResponse.parse(await response.json());
    await pc.setRemoteDescription({ type: "answer", sdp: created.sdpAnswer });

    return { sessionId: created.sessionId, endsAt: created.endsAt, end: close };
  } catch (err) {
    close();
    throw err;
  }
}
