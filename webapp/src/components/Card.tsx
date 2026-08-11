import React from "react";
import type { CardCode, Rank } from "../types/game";
import { isRedSuit, parseCard } from "../utils/cardHelpers";

interface CardProps {
  card: CardCode;
  size?: "sm" | "md" | "lg";
  playable?: boolean;
  faceDown?: boolean;
  selected?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
  className?: string;
}

const SIZE_PX: Record<NonNullable<CardProps["size"]>, { w: number; h: number }> = {
  sm: { w: 44, h: 62 },
  md: { w: 56, h: 78 },
  lg: { w: 68, h: 95 },
};

// Traditional pip layouts (as fractions of a 0-100/0-140 card), matching the
// standard positions used on real French-suited playing cards. `rot` means the
// pip is drawn upside down, as on the bottom half of a real card.
const PIP_LAYOUTS: Record<string, { x: number; y: number; rot?: boolean }[]> = {
  "2": [{ x: 50, y: 28 }, { x: 50, y: 112, rot: true }],
  "3": [{ x: 50, y: 28 }, { x: 50, y: 70 }, { x: 50, y: 112, rot: true }],
  "4": [{ x: 32, y: 28 }, { x: 68, y: 28 }, { x: 32, y: 112, rot: true }, { x: 68, y: 112, rot: true }],
  "5": [
    { x: 32, y: 28 }, { x: 68, y: 28 },
    { x: 32, y: 112, rot: true }, { x: 68, y: 112, rot: true },
    { x: 50, y: 70 },
  ],
  "6": [
    { x: 32, y: 28 }, { x: 68, y: 28 },
    { x: 32, y: 70 }, { x: 68, y: 70 },
    { x: 32, y: 112, rot: true }, { x: 68, y: 112, rot: true },
  ],
  "7": [
    { x: 32, y: 28 }, { x: 68, y: 28 },
    { x: 32, y: 70 }, { x: 68, y: 70 },
    { x: 32, y: 112, rot: true }, { x: 68, y: 112, rot: true },
    { x: 50, y: 49 },
  ],
  "8": [
    { x: 32, y: 28 }, { x: 68, y: 28 },
    { x: 32, y: 70 }, { x: 68, y: 70 },
    { x: 32, y: 112, rot: true }, { x: 68, y: 112, rot: true },
    { x: 50, y: 49 }, { x: 50, y: 91, rot: true },
  ],
  "9": [
    { x: 32, y: 24 }, { x: 68, y: 24 },
    { x: 32, y: 53 }, { x: 68, y: 53 },
    { x: 50, y: 70 },
    { x: 32, y: 87, rot: true }, { x: 68, y: 87, rot: true },
    { x: 32, y: 116, rot: true }, { x: 68, y: 116, rot: true },
  ],
  "10": [
    { x: 32, y: 22 }, { x: 68, y: 22 },
    { x: 50, y: 38 },
    { x: 32, y: 53 }, { x: 68, y: 53 },
    { x: 32, y: 87, rot: true }, { x: 68, y: 87, rot: true },
    { x: 50, y: 102, rot: true },
    { x: 32, y: 118, rot: true }, { x: 68, y: 118, rot: true },
  ],
};

/** Simple illustrated court-card figure: head, collar, and rank-specific headwear. */
function FaceIllustration({ rank, color }: { rank: "J" | "Q" | "K"; color: string }) {
  return (
    <g>
      <rect x="16" y="16" width="68" height="108" rx="3" fill="none" stroke={color} strokeOpacity="0.35" />
      <text
        x="50" y="66" fontSize="46" textAnchor="middle" fill={color} fillOpacity="0.13"
        fontWeight="500" fontFamily="Georgia, serif"
      >
        {rank}
      </text>
      <path d="M35 82 Q50 63 65 82 L65 100 Q50 108 35 100 Z" fill={color} />
      <circle cx="50" cy="55" r="13" fill={color} />
      {rank === "K" && <path d="M38 43 L44 33 L50 41 L56 33 L62 43 Z" fill={color} />}
      {rank === "Q" && <path d="M38 42 Q50 30 62 42 L59 48 Q50 40 41 48 Z" fill={color} />}
      {rank === "J" && <path d="M40 44 Q50 30 60 44 L56 46 Q50 38 44 46 Z" fill={color} />}
    </g>
  );
}

/** A realistic playing card: English corner indices, real pip layouts, illustrated court cards. */
export default function Card({
  card,
  size = "md",
  playable = true,
  faceDown = false,
  selected = false,
  onClick,
  style,
  className = "",
}: CardProps) {
  const { suit, rank } = parseCard(card);
  const red = isRedSuit(suit);
  const color = red ? "#b3221f" : "#1a1a1a";
  const { w, h } = SIZE_PX[size];

  const wrapperClass = [
    "relative rounded-lg select-none transition-all duration-200 bg-transparent p-0 border-0",
    onClick ? "cursor-pointer active:scale-95" : "cursor-default",
    playable ? "opacity-100" : "opacity-45 grayscale-[0.3]",
    selected ? "-translate-y-3 ring-2 ring-brass-400 rounded-lg" : "",
    className,
  ].join(" ");

  if (faceDown) {
    return (
      <div className={wrapperClass} style={style}>
        <svg viewBox="0 0 100 140" width={w} height={h} className="shadow-card rounded-lg">
          <rect x="2" y="2" width="96" height="136" rx="8" fill="#0e3b2c" stroke="#d4a94a66" strokeWidth="2" />
          <rect x="10" y="10" width="80" height="120" rx="5" fill="none" stroke="#d4a94a44" strokeWidth="1.5" />
        </svg>
      </div>
    );
  }

  return (
    <button type="button" disabled={!onClick} onClick={onClick} style={style} className={wrapperClass}>
      <svg viewBox="0 0 100 140" width={w} height={h} className="shadow-card rounded-lg">
        <rect x="1" y="1" width="98" height="138" rx="7" fill="#fdfcf8" stroke="#00000018" />

        <text x="8" y="20" fontSize="15" fontWeight="500" fill={color} fontFamily="Georgia, serif">{rank}</text>
        <text x="8" y="34" fontSize="13" fill={color}>{suit}</text>
        <g transform="rotate(180 50 70)">
          <text x="8" y="20" fontSize="15" fontWeight="500" fill={color} fontFamily="Georgia, serif">{rank}</text>
          <text x="8" y="34" fontSize="13" fill={color}>{suit}</text>
        </g>

        {rank === "A" && (
          <text x="50" y="82" fontSize="42" textAnchor="middle" fill={color}>{suit}</text>
        )}

        {(rank === "J" || rank === "Q" || rank === "K") && (
          <FaceIllustration rank={rank as "J" | "Q" | "K"} color={color} />
        )}

        {PIP_LAYOUTS[rank as Rank] &&
          PIP_LAYOUTS[rank as Rank].map((p, i) => (
            <text
              key={i}
              x={p.x}
              y={p.y + 5}
              fontSize="15"
              textAnchor="middle"
              fill={color}
              transform={p.rot ? `rotate(180 ${p.x} ${p.y})` : undefined}
            >
              {suit}
            </text>
          ))}
      </svg>
    </button>
  );
}
