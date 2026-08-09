import React from "react";
import { useTranslation } from "react-i18next";
import { useGameState } from "../hooks/useGameState";

/** End-of-game screen: shows the winning team, final score, and a reset button. */
export default function GameOver() {
  const { t } = useTranslation();
  const { winnerTeam, team1Score, team2Score } = useGameState();
  const reset = useGameState((s) => s.reset);

  const winnerLabel = winnerTeam === "team1" ? t("game.team1") : t("game.team2");
  const isTeam1 = winnerTeam === "team1";

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-10 gap-8 text-center">
      <div>
        <p className="text-parchment/60 text-sm mb-2">{t("game.game_over")}</p>
        <h1
          className={[
            "text-3xl font-extrabold animate-pop-in",
            isTeam1 ? "text-team1-light" : "text-team2-light",
          ].join(" ")}
        >
          {t("game.winner")}: {winnerLabel}
        </h1>
      </div>

      <div className="flex items-center gap-6 bg-white/5 rounded-2xl px-6 py-4 border border-brass-500/20">
        <div className="flex flex-col items-center">
          <span className="text-xs text-parchment/60">{t("game.team1")}</span>
          <span className="text-2xl font-bold text-team1-light">{team1Score}</span>
        </div>
        <span className="text-parchment/30">—</span>
        <div className="flex flex-col items-center">
          <span className="text-xs text-parchment/60">{t("game.team2")}</span>
          <span className="text-2xl font-bold text-team2-light">{team2Score}</span>
        </div>
      </div>

      <button
        onClick={reset}
        className="rounded-lg bg-brass-500 text-felt-950 font-bold px-8 py-3 shadow-card active:scale-95 transition-transform"
      >
        {t("game.play_again")}
      </button>
    </div>
  );
}
