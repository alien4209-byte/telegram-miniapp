import type { CardCode, Rank, Suit } from "./types";
import { RANKS, SUITS } from "./types";

// Pure card math shared by the game room and the bot AI. Nothing in this file
// touches WebSockets, Durable Object state, or persistence — just cards.

export const RANK_VALUE: Record<string, number> = RANKS.reduce(
  (acc, rank, i) => ({ ...acc, [rank]: i }),
  {} as Record<string, number>
);

export function parseSuit(card: CardCode): Suit {
  return card.charAt(0) as Suit;
}

export function parseRank(card: CardCode): Rank {
  return card.slice(1) as Rank;
}

/** Builds a full 52-card deck and shuffles it with a crypto-backed Fisher-Yates. */
export function buildShuffledDeck(): CardCode[] {
  const deck: CardCode[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(`${suit}${rank}`);
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const rand = new Uint32Array(1);
    crypto.getRandomValues(rand);
    const j = rand[0] % (i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** True if `challenger` beats `current` given the trick's lead suit and the trump suit. */
export function isHigher(challenger: CardCode, current: CardCode, leadSuit: Suit, trump: Suit | null): boolean {
  const cSuit = parseSuit(challenger);
  const curSuit = parseSuit(current);
  const cIsTrump = trump !== null && cSuit === trump;
  const curIsTrump = trump !== null && curSuit === trump;

  if (cIsTrump && !curIsTrump) return true;
  if (!cIsTrump && curIsTrump) return false;
  if (cIsTrump && curIsTrump) return RANK_VALUE[parseRank(challenger)] > RANK_VALUE[parseRank(current)];

  const cFollowsLead = cSuit === leadSuit;
  const curFollowsLead = curSuit === leadSuit;
  if (cFollowsLead && !curFollowsLead) return true;
  if (!cFollowsLead && curFollowsLead) return false;
  if (cFollowsLead && curFollowsLead) return RANK_VALUE[parseRank(challenger)] > RANK_VALUE[parseRank(current)];

  return false; // neither trump nor lead suit — can never win the trick
}

export function pickLowest(cards: CardCode[]): CardCode {
  return cards.reduce((min, c) => (RANK_VALUE[parseRank(c)] < RANK_VALUE[parseRank(min)] ? c : min));
}

const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
export function toPersianDigits(n: number): string {
  return String(n)
    .split("")
    .map((d) => PERSIAN_DIGITS[Number(d)] ?? d)
    .join("");
}
