import { Blob } from "./Blob.tsx";

/** The app-start loader: shown while signing in and fetching the Learner's details. */
export function AppLoader({ color }: { color: string }) {
  return (
    <div aria-busy="true" className="flex grow flex-col items-center justify-center gap-5 p-8 text-center">
      <p role="status" className="sr-only">
        Getting things ready…
      </p>
      <Blob color={color} mood="thinking" size={170} className="desk:h-auto desk:w-[220px]" />
      <div className="flex gap-2" aria-hidden="true">
        <span className="loader-dot size-3.5 rounded-full border-[2.5px] border-line bg-body" />
        <span className="loader-dot size-3.5 rounded-full border-[2.5px] border-line bg-body" />
        <span className="loader-dot size-3.5 rounded-full border-[2.5px] border-line bg-body" />
      </div>
      <span className="font-display text-[34px] font-black">Immersr</span>
      <p aria-hidden="true" className="m-0 text-[15px] text-muted">
        Getting things ready…
      </p>
    </div>
  );
}
