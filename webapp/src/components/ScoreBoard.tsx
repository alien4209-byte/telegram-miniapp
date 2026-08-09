import React from "react";
import { useTranslation } from "react-i18next";
import type { Suit } from "../types/game";

interface ScoreBoardProps {
  team1Score: number;
  team2Score: number;
  trumpSuit: Suit | null;
}

/** Compact header bar: team scores (color-coded) and the trump suit indicator. */
export default function ScoreBoard({ team1Score, team2Score, trumpSuit }: ScoreBoardProps) {
  const { t } = useTranslation();
  const isRedTrump = trumpSuit === "♥" || trumpSuit === "♦";

  return (
    <div className="flex items-center justify-between px-4 py-2.5 bg-felt-950/60 backdrop-blur-sm border-b border-brass-500/20">
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-team1" />
        <span className="text-xs text-parchment/80">{t("game.team1")}</span>
        <span className="text-sm font-bold text-team1-light">{team1Score}</span>
      </div>

      {trumpSuit && (
        <div className="flex items-center gap-1.5 bg-brass-500/15 border border-brass-500/40 rounded-full px-3 py-1">
          <span className={`text-lg leading-none ${isRedTrump ? "text-team1-light" : "text-parchment"}`}>
            {trumpSuit}
          </span>
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <span className="text-sm font-bold text-team2-light">{team2Score}</span>
        <span className="text-xs text-parchment/80">{t("game.team2")}</span>
        <span className="w-2.5 h-2.5 rounded-full bg-team2" />
      </div>
    </div>
  );
}
