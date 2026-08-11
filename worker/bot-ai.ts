import type { CardCode, Suit, TrickCard } from "./types";
import { SUITS } from "./types";
import { isHigher, parseSuit, pickLowest } from "./card-utils";

// Pure decision functions for bot players. No side effects, no game-room state —
// given a hand (and, for card play, the current trick), return what the bot does.
// This keeps the AI trivially testable and easy to improve independently of the
// Durable Object's message handling.

/** Trump choice: pick the suit the bot holds the most of (maximizes trump control). */
export function chooseTrumpSuit(hand: CardCode[]): Suit {
  const counts: Record<Suit, number> = { "♠": 0, "♥": 0, "♦": 0, "♣": 0 };
  for (const card of hand) counts[parseSuit(card)]++;

  let bestSuit: Suit = SUITS[0];
  let bestCount = -1;
  for (const suit of SUITS) {
    if (counts[suit] > bestCount) {
      bestCount = counts[suit];
      bestSuit = suit;
    }
  }
  return bestSuit;
}

/**
 * Card play: follow suit and win as cheaply as possible; otherwise trump in cheaply
 * if void of the lead suit; otherwise discard the lowest card. Not a strong AI, but
 * plays entirely within the rules and isn't a pushover.
 */
export function chooseCardToPlay(hand: CardCode[], trick: TrickCard[], trump: Suit | null): CardCode {
  if (trick.length === 0) {
    // Leading the trick: play safe with the lowest card in hand.
    return pickLowest(hand);
  }

  const leadSuit = parseSuit(trick[0].card);
  const followable = hand.filter((c) => parseSuit(c) === leadSuit);

  const currentWinner = (): CardCode => {
    let winning = trick[0].card;
    for (const played of trick.slice(1)) {
      if (isHigher(played.card, winning, leadSuit, trump)) winning = played.card;
    }
    return winning;
  };

  if (followable.length > 0) {
    const winner = currentWinner();
    const winners = followable.filter((c) => isHigher(c, winner, leadSuit, trump));
    return winners.length > 0 ? pickLowest(winners) : pickLowest(followable);
  }

  if (trump) {
    const trumps = hand.filter((c) => parseSuit(c) === trump);
    if (trumps.length > 0) {
      const winner = currentWinner();
      const winningTrumps = trumps.filter((c) => isHigher(c, winner, leadSuit, trump));
      return winningTrumps.length > 0 ? pickLowest(winningTrumps) : pickLowest(trumps);
    }
  }

  return pickLowest(hand);
}
