import React from "react";
import { useTranslation } from "react-i18next";
import Card from "./Card";
import type { PlayedCard } from "../types/game";

interface TrickAreaProps {
  trick: PlayedCard[];
  currentTurnPlayer: string | null;
  lastTrickWinner: string | null;
  trickNumber: number;
}

// Positions for up to 4 played cards around a small circular table.
const POSITIONS = [
  "translate-y-6",           // bottom (south) — usually self
  "-translate-x-10",         // left (west)
  "-translate-y-6",          // top (north)
  "translate-x-10",          // right (east)
];

/** The center of the table: shows cards played so far this trick, and whose turn it is. */
export default function TrickArea({ trick, currentTurnPlayer, lastTrickWinner, trickNumber }: TrickAreaProps) {
  const { t } = useTranslation();

  return (
    <div className="relative flex flex-col items-center justify-center py-6">
      <div className="text-xs text-parchment/60 mb-2">
        {trickNumber > 0 ? t("game.trick_number", { number: trickNumber }) : null}
      </div>

      <div className="relative w-52 h-40">
        {trick.length === 0 && currentTurnPlayer && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm text-parchment/70 animate-shimmer">
              {t("game.opponent_turn", { name: currentTurnPlayer })}
            </span>
          </div>
        )}

        {trick.map((played, i) => (
          <div
            key={`${played.player}-${played.card}-${i}`}
            className={`absolute inset-0 flex items-center justify-center ${POSITIONS[i % POSITIONS.length]} animate-play-card`}
          >
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-parchment/80 bg-felt-950/60 px-1.5 py-0.5 rounded">
                {played.player}
              </span>
              <Card card={played.card} size="md" onClick={undefined} />
            </div>
          </div>
        ))}
      </div>

      {lastTrickWinner && trick.length === 0 && (
        <div className="mt-2 text-sm font-bold text-brass-400 animate-pop-in">
          {t("game.trick_won", { player: lastTrickWinner })}
        </div>
      )}
    </div>
  );
}
