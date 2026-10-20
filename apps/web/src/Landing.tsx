import type { Language } from "@immersr/shared";
import { Blob } from "./Blob.tsx";
import { Scene } from "./Scenes.tsx";
import { THEMES } from "./themes.ts";
import { signIn } from "./auth.ts";

const STEPS = [
  "Pick a language, a Level and a Topic",
  "Talk with Blob: it only speaks the language you're acquiring",
  "Watch your hours of Immersion time grow",
];

// The Landing screen for signed-out visitors. On a wide window it splits: the pitch on the left, the scene on the right.
export function Landing({ language, onPrivacy }: { language: Language; onPrivacy(): void }) {
  const theme = THEMES[language];
  return (
    <div className="flex grow flex-col desk:grid desk:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="relative border-b-[3px] border-line desk:order-2 desk:min-h-[560px] desk:border-b-0 desk:border-l-[3px]">
        <div className="desk:absolute desk:inset-0">
          <Scene language={language} className="h-[330px] desk:h-full" />
        </div>
        <div className="absolute inset-x-0 bottom-[34px] flex justify-center desk:bottom-[60px]">
          <Blob color={theme.body} mood="happy" size={170} label="Blob waving hello" className="desk:h-auto desk:w-[260px]" />
        </div>
      </div>
      <div className="flex grow flex-col gap-4 px-[22px] pb-7 pt-[22px] desk:order-1 desk:justify-center desk:gap-6 desk:px-16 desk:py-14">
        <h1 className="font-display text-[40px] font-black desk:text-7xl">Immersr</h1>
        <p className="text-lg leading-snug desk:max-w-[520px] desk:text-2xl">
          Real conversation in the language you're acquiring. <b>They speak it. You answer in English.</b>
        </p>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[15px] desk:gap-2.5 desk:text-lg">
          {STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <div className="grow desk:hidden" />
        <button
          type="button"
          className="chunk-btn flex items-center justify-center gap-2.5 bg-white text-[#141414] desk:mt-2 desk:self-start desk:px-8"
          onClick={() => void signIn()}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" fill="#4285F4" />
            <path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" fill="#34A853" />
            <path d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2z" fill="#FBBC05" />
            <path d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10C7.2 7.8 9.4 6 12 6z" fill="#EA4335" />
          </svg>
          Sign in with Google
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 cursor-pointer items-center justify-center p-0 font-bold text-ink underline desk:justify-start"
          onClick={onPrivacy}
        >
          Privacy: what Immersr stores
        </button>
      </div>
    </div>
  );
}
