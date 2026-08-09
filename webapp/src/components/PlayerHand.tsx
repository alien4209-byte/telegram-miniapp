import React from "react";
import { useTranslation } from "react-i18next";
import Card from "./Card";
import type { CardCode, Suit } from "../types/game";
import { getPlayableCards, parseCard } from "../utils/cardHelpers";

interface PlayerHandProps {
  hand: CardCode[];
  isMyTurn: boolean;
  leadSuit: Suit | null;
  onPlay: (card: CardCode) => void;
}

/** Renders the local player's 13 cards in a horizontal scroll strip, fanned like a real hand. */
export default function PlayerHand({ hand, isMyTurn, leadSuit, onPlay }: PlayerHandProps) {
  const { t } = useTranslation();
  const playable = new Set(isMyTurn ? getPlayableCards(hand, leadSuit) : []);

  if (hand.length === 0) {
    return (
      <div className="py-6 text-center text-parchment/50 text-sm">{t("game.no_cards")}</div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between px-4 mb-1.5">
        <span className="text-xs text-parchment/70">{t("game.your_hand")}</span>
        <span
          className={`text-xs font-bold ${isMyTurn ? "text-brass-400 animate-shimmer" : "text-parchment/40"}`}
        >
          {isMyTurn ? t("game.your_turn") : t("game.wait_for_turn")}
        </span>
      </div>
      <div
        dir="ltr"
        className="flex gap-2 overflow-x-auto px-4 pb-3 pt-2 snap-x scrollbar-hide"
        style={{ scrollbarWidth: "none" }}
      >
        {hand.map((card, i) => {
          const isPlayable = playable.has(card);
          return (
            <div key={card} className="snap-center shrink-0 animate-deal-in" style={{ animationDelay: `${i * 25}ms` }}>
              <Card
                card={card}
                size="lg"
                playable={!isMyTurn || isPlayable}
                onClick={isMyTurn && isPlayable ? () => onPlay(card) : undefined}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Derives the current trick's leading suit from the first played card, if any. */
export function deriveLeadSuit(trick: { card: CardCode }[]): Suit | null {
  if (trick.length === 0) return null;
  return parseCard(trick[0].card).suit;
}
