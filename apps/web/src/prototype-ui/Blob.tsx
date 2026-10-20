// PROTOTYPE (throwaway): the Blob Mascot. Brows, mouth and hands act out the Partner state.
export type BlobMood = "idle" | "speaking" | "listening" | "thinking" | "happy";

const INK = "#141414";
const BODY_PATH =
  "M110 28 C160 26 192 70 188 122 C184 170 152 194 108 192 C62 190 30 162 32 116 C34 66 64 30 110 28 Z";

interface Pose {
  hands: [number, number, number, number]; // left cx, cy, right cx, cy
  pupils: [number, number, number, number];
  brows: [string, string];
  mouth: "open" | "smile" | "o" | "grin";
  tilt: number;
}

const POSES: Record<BlobMood, Pose> = {
  idle: { hands: [28, 132, 192, 132], pupils: [92, 105, 138, 105], brows: ["M68 70 Q86 62 104 70", "M118 70 Q136 62 154 70"], mouth: "smile", tilt: 0 },
  speaking: { hands: [26, 110, 196, 100], pupils: [92, 105, 138, 105], brows: ["M66 66 Q86 54 106 64", "M118 64 Q138 54 158 66"], mouth: "open", tilt: 0 },
  listening: { hands: [40, 124, 190, 146], pupils: [85, 104, 131, 104], brows: ["M68 74 Q86 70 104 76", "M118 70 Q138 60 156 66"], mouth: "smile", tilt: -7 },
  thinking: { hands: [30, 140, 140, 168], pupils: [95, 95, 141, 95], brows: ["M68 72 L104 74", "M118 62 Q138 50 156 58"], mouth: "o", tilt: 0 },
  happy: { hands: [24, 96, 198, 66], pupils: [92, 105, 138, 105], brows: ["M66 66 Q86 54 106 64", "M118 64 Q138 54 158 66"], mouth: "grin", tilt: 0 },
};

export function Blob({ color, mood, size = 160, label }: { color: string; mood: BlobMood; size?: number; label?: string }) {
  const p = POSES[mood];
  const stroke = { stroke: INK, strokeWidth: 2.5 };
  return (
    <svg
      viewBox="0 0 220 230"
      width={size}
      height={(size * 230) / 220}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`proto-blob proto-blob--${mood}`}
    >
      <g style={{ filter: "drop-shadow(6px 7px 0 rgba(20,20,20,0.28))" }}>
        <g transform={`rotate(${p.tilt} 110 120)`}>
          <rect x="84" y="176" width="14" height="38" rx="7" fill={color} {...stroke} />
          <rect x="124" y="176" width="14" height="38" rx="7" fill={color} {...stroke} />
          <ellipse cx="88" cy="214" rx="14" ry="6" fill={color} {...stroke} />
          <ellipse cx="134" cy="214" rx="14" ry="6" fill={color} {...stroke} />
          <path d={BODY_PATH} fill={color} {...stroke} />
          <circle className="proto-blob__hand" cx={p.hands[0]} cy={p.hands[1]} r="11" fill={color} {...stroke} />
          <circle className="proto-blob__hand" cx={p.hands[2]} cy={p.hands[3]} r="11" fill={color} {...stroke} />
          <circle cx="88" cy="102" r="22" fill="#FFFFFF" {...stroke} />
          <circle cx="134" cy="102" r="22" fill="#FFFFFF" {...stroke} />
          <circle cx={p.pupils[0]} cy={p.pupils[1]} r="9" fill={INK} />
          <circle cx={p.pupils[2]} cy={p.pupils[3]} r="9" fill={INK} />
          <path d={p.brows[0]} stroke={INK} strokeWidth="7" fill="none" strokeLinecap="round" />
          <path d={p.brows[1]} stroke={INK} strokeWidth="7" fill="none" strokeLinecap="round" />
          {p.mouth === "open" && <ellipse className="proto-blob__mouth" cx="111" cy="146" rx="11" ry="9" fill={INK} />}
          {p.mouth === "smile" && <path d="M100 144 Q111 152 122 144" stroke={INK} strokeWidth="4" fill="none" strokeLinecap="round" />}
          {p.mouth === "o" && <circle cx="120" cy="146" r="5.5" fill={INK} />}
          {p.mouth === "grin" && <path d="M96 140 Q111 160 126 140 Z" fill={INK} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />}
          {mood === "thinking" && (
            <g fill={INK}>
              <circle cx="176" cy="40" r="5" opacity="0.4" />
              <circle cx="190" cy="26" r="6" opacity="0.6" />
              <circle cx="204" cy="12" r="7" />
            </g>
          )}
        </g>
      </g>
    </svg>
  );
}
