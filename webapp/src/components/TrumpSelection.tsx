import React from "react";
import { useTranslation } from "react-i18next";
import { useGameState } from "../hooks/useGameState";
import { useGameActions } from "../contexts/GameContext";
import type { Suit } from "../types/game";
import { isRedSuit } from "../utils/cardHelpers";

const ALL_SUITS: Suit[] = ["♠", "♥", "♦", "♣"];

/** Trump-selection screen: the Hakem picks a suit, everyone else waits. */
export default function TrumpSelection() {
  const { t } = useTranslation();
  const { isHakem, hakem, availableSuits, trumpSuit } = useGameState();
  const { setTrump } = useGameActions();

  const suits = availableSuits.length > 0 ? availableSuits : ALL_SUITS;

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-10 gap-8">
      <div className="text-center">
        {hakem && (
          <p className="text-parchment/70 text-sm mb-1">{t("game.hakem_is", { name: hakem })}</p>
        )}
        <h2 className="text-xl font-bold text-brass-400">
          {trumpSuit
            ? t("game.trump_selected", { suit: trumpSuit })
            : isHakem
              ? t("game.select_trump")
              : t("game.waiting_for_hakem")}
        </h2>
      </div>

      {isHakem && !trumpSuit && (
        <div className="grid grid-cols-2 gap-4">
          {suits.map((suit) => (
            <button
              key={suit}
              onClick={() => setTrump(suit)}
              className={[
                "w-24 h-24 rounded-2xl bg-parchment shadow-card flex items-center justify-center text-4xl",
                "active:scale-90 transition-transform border-4 border-transparent hover:border-brass-400",
                isRedSuit(suit) ? "text-team1" : "text-felt-950",
              ].join(" ")}
            >
              {suit}
            </button>
          ))}
        </div>
      )}

      {!isHakem && !trumpSuit && (
        <div className="flex gap-3">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-3 h-3 rounded-full bg-brass-400 animate-shimmer"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      )}

      {trumpSuit && (
        <div
          className={[
            "text-7xl animate-pop-in",
            isRedSuit(trumpSuit) ? "text-team1-light" : "text-parchment",
          ].join(" ")}
        >
          {trumpSuit}
        </div>
      )}
    </div>
  );
}
