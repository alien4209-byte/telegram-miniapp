import type { CardCode, Rank, Suit } from "../types/game";

export const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];

export const RANK_ORDER: Rank[] = [
  "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A",
];

const RANK_VALUE: Record<Rank, number> = RANK_ORDER.reduce(
  (acc, rank, idx) => ({ ...acc, [rank]: idx }),
  {} as Record<Rank, number>
);

const RED_SUITS = new Set<Suit>(["♥", "♦"]);

/** Parses a wire-format card code like "♠A" or "♥10" into its suit + rank. */
export function parseCard(card: CardCode): { suit: Suit; rank: Rank } {
  const suit = card.charAt(0) as Suit;
  const rank = card.slice(1) as Rank;
  return { suit, rank };
}

export function isRedSuit(suit: Suit): boolean {
  return RED_SUITS.has(suit);
}

/** Sorts a hand grouped by suit (spades, hearts, diamonds, clubs), rank ascending within each. */
export function sortHand(hand: CardCode[]): CardCode[] {
  return [...hand].sort((a, b) => {
    const ca = parseCard(a);
    const cb = parseCard(b);
    const suitDiff = SUITS.indexOf(ca.suit) - SUITS.indexOf(cb.suit);
    if (suitDiff !== 0) return suitDiff;
    return RANK_VALUE[ca.rank] - RANK_VALUE[cb.rank];
  });
}

/**
 * Determines which cards in `hand` are legally playable given the current trick.
 * Hokm rule: must follow the suit led if you hold any card of that suit.
 * If the leading suit isn't held, any card (including trump) is playable.
 * If it's the first card of the trick, any card is playable.
 */
export function getPlayableCards(hand: CardCode[], leadSuit: Suit | null): CardCode[] {
  if (!leadSuit) return hand;
  const followable = hand.filter((c) => parseCard(c).suit === leadSuit);
  return followable.length > 0 ? followable : hand;
}

/** Translates a rank into a Persian display label using the i18n `cards` namespace values. */
export function rankTranslationKey(rank: Rank): string {
  return `cards.${rank}`;
}

export function suitTranslationKey(suit: Suit): string {
  const map: Record<Suit, string> = {
    "♠": "cards.spades",
    "♥": "cards.hearts",
    "♦": "cards.diamonds",
    "♣": "cards.clubs",
  };
  return map[suit];
}
