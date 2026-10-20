import { Blob } from "./Blob.tsx";

/** Shown instead of the app when the device has no network. */
export function Offline({ color }: { color: string }) {
  return (
    <div className="flex min-h-dvh grow flex-col items-center justify-center gap-5 bg-bg p-8 text-center text-ink">
      <Blob color={color} mood="thinking" size={170} className="desk:h-auto desk:w-[220px]" />
      <h1 className="m-0 font-display text-[34px] font-black">You're offline</h1>
      <p role="status" className="m-0 max-w-sm text-[17px] text-muted">
        You're offline. Immersr needs a connection to talk to Blob.
      </p>
    </div>
  );
}
