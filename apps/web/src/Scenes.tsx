import type { ReactElement } from "react";
import type { Language } from "@immersr/shared";

// The country scenes behind the Mascot, one per Target language. Purely decorative.

const INK = "#141414";
const s = { stroke: INK, strokeWidth: 2.5 } as const;

function Azulejo({ x, y, size = 60 }: { x: number; y: number; size?: number }) {
  const k = size / 60;
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <rect width="60" height="60" fill="#FFFFFF" stroke="#2F5DA8" strokeWidth="2" />
      <circle cx="30" cy="18" r="8" fill="#2F5DA8" />
      <circle cx="42" cy="30" r="8" fill="#2F5DA8" />
      <circle cx="30" cy="42" r="8" fill="#2F5DA8" />
      <circle cx="18" cy="30" r="8" fill="#2F5DA8" />
      <circle cx="30" cy="30" r="5" fill="#F2C230" />
      <path d="M0 0 L10 0 L0 10 Z M60 0 L50 0 L60 10 Z M0 60 L10 60 L0 50 Z M60 60 L50 60 L60 50 Z" fill="#2F5DA8" />
    </g>
  );
}

function StarTile({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="-18" y="-18" width="36" height="36" fill="#F2B705" />
      <rect x="-18" y="-18" width="36" height="36" fill="#F2B705" transform="rotate(45)" />
      <circle r="8" fill="#C8352A" />
    </g>
  );
}

function Sardine({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 14 Q30 -2 62 14 Q30 30 0 14 Z" fill="#A9BCD0" {...s} />
      <path d="M62 14 L78 2 L76 26 Z" fill="#A9BCD0" {...s} strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.5" fill={INK} />
    </g>
  );
}

function PortugalBackdrop() {
  return (
    <>
      <rect x="-1" y="-3000" width="402" height="3420" fill="#F3F6FB" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <Azulejo key={i} x={(i * 400) / 7} y={15} size={400 / 7} />
      ))}
      <rect x="-1" y="372" width="402" height="48" fill="#FFFFFF" />
      <path d="M-1 372 L401 372" stroke={INK} strokeWidth="2" />
      <path d="M0 386 Q25 376 50 386 T100 386 T150 386 T200 386 T250 386 T300 386 T350 386 T400 386" stroke={INK} strokeWidth="5" fill="none" />
      <path d="M0 404 Q25 394 50 404 T100 404 T150 404 T200 404 T250 404 T300 404 T350 404 T400 404" stroke={INK} strokeWidth="5" fill="none" />
    </>
  );
}

function PortugalProps() {
  return (
    <>
      <g transform="translate(22 92)">
        <rect x="24" y="0" width="12" height="76" rx="3" fill="#8B5A2B" {...s} />
        <path d="M16 4 Q30 -10 44 4 L40 14 L20 14 Z" fill="#C98B4E" {...s} strokeLinejoin="round" />
        <circle cx="30" cy="104" r="32" fill="#C98B4E" {...s} />
        <circle cx="30" cy="100" r="10" fill="#3A2618" />
      </g>
      <Sardine x={300} y={92} />
      <Sardine x={288} y={128} />
      <g transform="translate(300 262) scale(0.78)">
        <path d="M60 0 L60 -26" stroke={INK} strokeWidth="2.5" />
        <rect x="6" y="0" width="112" height="16" rx="6" fill="#E9E3D5" {...s} />
        <rect x="0" y="14" width="124" height="76" rx="12" fill="#F2C230" {...s} />
        {[12, 50, 88].map((x) => (
          <rect key={x} x={x} y="26" width="24" height="26" rx="4" fill="#CFE2F6" stroke={INK} strokeWidth="2" />
        ))}
        <circle cx="28" cy="96" r="10" fill={INK} />
        <circle cx="96" cy="96" r="10" fill={INK} />
      </g>
      <g transform="translate(18 300)">
        <ellipse cx="34" cy="26" rx="32" ry="16" fill="#C4802F" {...s} />
        <ellipse cx="34" cy="22" rx="24" ry="10" fill="#F6C744" stroke={INK} strokeWidth="2" />
        <circle cx="26" cy="20" r="3.5" fill="#6B3A12" />
        <circle cx="40" cy="24" r="4" fill="#6B3A12" />
      </g>
    </>
  );
}

const SPAIN_GROUND = (
  <g stroke={INK} strokeWidth="2" strokeLinejoin="round">
    <path d="M0 372 L46 372 L38 396 L0 400 Z" fill="#2F6FBF" />
    <path d="M46 372 L104 372 L96 404 L40 398 Z" fill="#F2C230" />
    <path d="M104 372 L150 372 L156 400 L98 404 Z" fill="#3E8E4F" />
    <path d="M150 372 L212 372 L204 398 L156 400 Z" fill="#FFFFFF" />
    <path d="M212 372 L262 372 L268 402 L204 398 Z" fill="#C8352A" />
    <path d="M262 372 L330 372 L322 400 L268 402 Z" fill="#2F6FBF" />
    <path d="M330 372 L400 372 L400 398 L322 400 Z" fill="#F2C230" />
    <path d="M-1 400 L38 396 L96 404 L156 400 L204 398 L268 402 L322 400 L401 398 L401 420 L-1 420 Z" fill="#F08A24" />
  </g>
);

function SpainBackdrop() {
  return (
    <>
      <rect x="-1" y="-3000" width="402" height="3420" fill="#FCEBD3" />
      <rect x="-1" y="-3000" width="402" height="3082" fill="#C8352A" />
      {[40, 120, 200, 280, 360].map((x) => (
        <StarTile key={x} x={x} y={41} />
      ))}
      {SPAIN_GROUND}
    </>
  );
}

function SpainProps() {
  return (
    <>
      <g transform="translate(340 132)">
        <path d="M0 -50 L0 -38 M0 50 L0 38 M-50 0 L-38 0 M50 0 L38 0 M-35 -35 L-27 -27 M35 35 L27 27 M35 -35 L27 -27 M-35 35 L-27 27" stroke="#E08A1E" strokeWidth="5" strokeLinecap="round" />
        <circle r="28" fill="#F7C548" {...s} />
      </g>
      <g transform="translate(18 104)">
        <path d="M22 132 L32 40 L62 40 L72 132 Z" fill="#FFFFFF" {...s} strokeLinejoin="round" />
        <path d="M26 44 L47 16 L68 44 Z" fill="#3A3A3A" {...s} strokeLinejoin="round" />
        <g {...s} strokeLinejoin="round" fill="#E9DCC3">
          <path d="M47 40 L12 8 L20 0 L50 34 Z" />
          <path d="M47 40 L82 8 L74 0 L44 34 Z" />
          <path d="M47 40 L12 72 L4 64 L44 36 Z" />
          <path d="M47 40 L82 72 L90 64 L50 36 Z" />
        </g>
        <circle cx="47" cy="40" r="5" fill={INK} />
      </g>
      <g transform="translate(312 196)">
        <path d="M30 74 L-14 20 A70 70 0 0 1 74 20 Z" fill="#C8352A" {...s} strokeLinejoin="round" />
        <path d="M30 74 L8 10 M30 74 L30 4 M30 74 L52 10" stroke="#F2B705" strokeWidth="3" />
      </g>
      <g transform="translate(16 290)">
        <circle cx="20" cy="30" r="17" fill="#F08A24" {...s} />
        <path d="M20 13 Q28 1 40 5 Q30 15 20 13 Z" fill="#3E8E4F" stroke={INK} strokeWidth="2" />
        <circle cx="52" cy="50" r="15" fill="#F08A24" {...s} />
      </g>
      <g transform="translate(286 318)">
        <ellipse cx="56" cy="24" rx="52" ry="22" fill="#2E2E2E" {...s} />
        <ellipse cx="56" cy="22" rx="44" ry="16" fill="#F2C230" />
        <path d="M30 18 L44 24 M60 14 L72 22 M78 26 L90 20" stroke="#C8352A" strokeWidth="4" strokeLinecap="round" />
      </g>
    </>
  );
}

const CREAM = "#F4E9D8";

function FranceBackdrop() {
  return (
    <>
      <rect x="-1" y="-3000" width="402" height="3420" fill="#1E3A6E" />
      <rect x="-1" width="402" height="84" fill={CREAM} />
      {[10, 30, 50, 70].map((y) => (
        <rect key={y} x="-1" y={y} width="402" height="9" fill="#1E3A6E" />
      ))}
      <path d="M-1 372 L401 372" stroke={CREAM} strokeWidth="2" />
    </>
  );
}

function FranceProps() {
  const cream = CREAM;
  return (
    <>
      <g transform="translate(20 98)" {...s}>
        <ellipse cx="26" cy="36" rx="24" ry="9" fill="#E9A3B8" />
        <ellipse cx="26" cy="27" rx="24" ry="9" fill="#E9A3B8" />
        <ellipse cx="26" cy="16" rx="22" ry="8" fill="#A8D5A2" />
        <ellipse cx="26" cy="8" rx="22" ry="8" fill="#A8D5A2" />
      </g>
      <g transform="translate(22 160)" stroke={cream} strokeWidth="4" fill="none" strokeLinecap="round">
        <path d="M10 0 Q32 -12 54 0" />
        <path d="M10 0 L12 52 M54 0 L52 52" />
        <ellipse cx="32" cy="52" rx="26" ry="7" />
        <path d="M12 56 L8 100 M52 56 L56 100" />
      </g>
      <g transform="translate(14 276) scale(0.8)">
        <path d="M0 40 Q10 0 50 0 Q90 0 100 40 Q76 24 50 26 Q24 24 0 40 Z" fill="#E8B262" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      </g>
      <g transform="translate(14 318)">
        <path d="M12 54 L10 4 M26 54 L28 0 M40 54 L44 8" stroke="#6E9B5A" strokeWidth="3" strokeLinecap="round" />
        {[[10, 6], [10, 15], [11, 24], [28, 2], [28, 11], [27, 20], [44, 10], [43, 19], [42, 28]].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="4" fill="#9B7FD1" />
        ))}
      </g>
      <g transform="translate(250 330) rotate(-18)">
        <rect width="130" height="22" rx="11" fill="#D9A15A" {...s} />
      </g>
      <g stroke={cream} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M344 104 L344 124 M344 124 L312 372 M344 124 L376 372 M330 222 L358 222 M322 294 L366 294 M306 372 Q344 314 382 372 M330 222 L358 294 M358 222 L330 294" />
      </g>
    </>
  );
}

const BACKDROP: Record<Language, () => ReactElement> = { "pt-PT": PortugalBackdrop, "es-ES": SpainBackdrop, "fr-FR": FranceBackdrop };
const PROPS: Record<Language, () => ReactElement> = { "pt-PT": PortugalProps, "es-ES": SpainProps, "fr-FR": FranceProps };

/**
 * A country scene filling a box, which `className` sizes (for example `h-[300px] desk:h-full`). The scene is fitted
 * inside the box and anchored to the bottom, so every cultural item stays in view whatever the box's shape; the
 * backdrop repeats sideways and its colour extends upwards to fill the spare space. Hidden from screen readers.
 */
export function Scene({ language, className }: { language: Language; className: string }) {
  const Backdrop = BACKDROP[language];
  const Props = PROPS[language];
  return (
    // The backdrop overflows the svg to fill the spare space, so this wrapper clips it to the box.
    <div className={`overflow-hidden ${className}`} data-scene={language}>
      <svg
        viewBox="0 0 400 420"
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMax meet"
        aria-hidden="true"
        focusable="false"
        className="block overflow-visible"
      >
        {[-2000, -1600, -1200, -800, -400, 0, 400, 800, 1200, 1600, 2000].map((dx) => (
          <g key={dx} transform={`translate(${dx} 0)`}>
            <Backdrop />
          </g>
        ))}
        <Props />
      </svg>
    </div>
  );
}
