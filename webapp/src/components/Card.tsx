import React from "react";
import { useTranslation } from "react-i18next";
import type { CardCode } from "../types/game";
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

const SIZE_MAP: Record<NonNullable<CardProps["size"]>, string> = {
  sm: "w-11 h-16 text-[10px]",
  md: "w-14 h-20 text-xs",
  lg: "w-16 h-24 text-sm",
};

/** A single classic playing card rendered with Persian rank labels and suit glyphs. */
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
  const { t } = useTranslation();
  const { suit, rank } = parseCard(card);
  const red = isRedSuit(suit);

  if (faceDown) {
    return (
      <div
        className={`${SIZE_MAP[size]} rounded-lg bg-gradient-to-br from-brass-600 to-felt-800 shadow-card border border-brass-500/40 flex items-center justify-center ${className}`}
        style={style}
      >
        <div className="w-2/3 h-2/3 rounded border border-brass-400/40 bg-felt-900/60" />
      </div>
    );
  }

  const rankLabel = t(`cards.${rank}`);

  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      style={style}
      className={[
        SIZE_MAP[size],
        "relative rounded-lg bg-parchment shadow-card select-none",
        "flex flex-col justify-between px-1.5 py-1",
        "transition-all duration-200",
        onClick ? "cursor-pointer active:scale-95" : "cursor-default",
        playable ? "opacity-100" : "opacity-45 grayscale-[0.3]",
        selected ? "-translate-y-3 shadow-card-lift ring-2 ring-brass-400" : "",
        red ? "text-team1" : "text-felt-950",
        className,
      ].join(" ")}
    >
      <span className="leading-none font-bold text-right">{rankLabel}</span>
      <span className="self-center text-lg leading-none">{suit}</span>
      <span className="leading-none font-bold text-left rotate-180">{rankLabel}</span>
    </button>
  );
}
