import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useGameState } from "../hooks/useGameState";
import { useGameActions } from "../contexts/GameContext";

/** Waiting room shown until 4 players have joined; then the game auto-starts. */
export default function Lobby() {
  const { t } = useTranslation();
  const { players, playerCount, requiredPlayers, selfName } = useGameState();
  const { joinGame } = useGameActions();
  const [name, setName] = useState(selfName ?? "");
  const [hasJoined, setHasJoined] = useState(!!selfName);

  const handleJoin = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setHasJoined(true);
    joinGame(trimmed);
  };

  const filledSlots = Math.min(playerCount, requiredPlayers);

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-10 gap-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-brass-400 mb-1">{t("game.title")}</h1>
        <p className="text-parchment/70 text-sm">{t("game.waiting_count", { count: filledSlots })}</p>
      </div>

      <div className="flex gap-3">
        {Array.from({ length: requiredPlayers }).map((_, i) => {
          const player = players[i];
          return (
            <div
              key={i}
              className={[
                "w-16 h-20 rounded-xl border-2 flex flex-col items-center justify-center gap-1",
                player ? "border-brass-500 bg-brass-500/10" : "border-parchment/20 bg-white/5 border-dashed",
              ].join(" ")}
            >
              <div
                className={[
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                  player ? "bg-brass-500 text-felt-950" : "bg-white/10 text-parchment/30",
                ].join(" ")}
              >
                {player ? player.name.charAt(0).toUpperCase() : "?"}
              </div>
              <span className="text-[10px] text-parchment/70 truncate w-14 text-center">
                {player ? player.name : ""}
              </span>
            </div>
          );
        })}
      </div>

      {!hasJoined ? (
        <div className="w-full max-w-xs flex flex-col gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("game.you") as string}
            maxLength={20}
            className="w-full rounded-lg bg-white/10 border border-parchment/20 px-4 py-3 text-parchment placeholder:text-parchment/40 text-center outline-none focus:border-brass-400"
          />
          <button
            onClick={handleJoin}
            disabled={!name.trim()}
            className="w-full rounded-lg bg-brass-500 disabled:bg-brass-500/30 disabled:cursor-not-allowed text-felt-950 font-bold py-3 shadow-card active:scale-95 transition-transform"
          >
            {t("buttons.join")}
          </button>
        </div>
      ) : (
        <p className="text-parchment/50 text-sm animate-shimmer">{t("game.join_prompt")}</p>
      )}
    </div>
  );
}
