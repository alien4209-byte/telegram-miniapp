import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useGameState } from "../hooks/useGameState";
import { useGameActions } from "../contexts/GameContext";
import ScoreBoard from "./ScoreBoard";
import TrickArea from "./TrickArea";
import PlayerHand, { deriveLeadSuit } from "./PlayerHand";

/** Main gameplay screen: score header, table/trick center, and the player's hand at the bottom. */
export default function GameBoard() {
  const { t } = useTranslation();
  const {
    hand,
    currentTrick,
    currentTurnPlayer,
    isMyTurn,
    lastTrickWinner,
    trickNumber,
    team1Score,
    team2Score,
    trumpSuit,
    errorMessage,
  } = useGameState();
  const { playCard } = useGameActions();
  const clearError = useGameState((s) => s.clearError);

  useEffect(() => {
    if (!errorMessage) return;
    const timeout = setTimeout(clearError, 2500);
    return () => clearTimeout(timeout);
  }, [errorMessage, clearError]);

  const leadSuit = deriveLeadSuit(currentTrick);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <ScoreBoard team1Score={team1Score} team2Score={team2Score} trumpSuit={trumpSuit} />

      <div className="flex-1 flex flex-col items-center justify-center relative">
        <TrickArea
          trick={currentTrick}
          currentTurnPlayer={isMyTurn ? null : currentTurnPlayer}
          lastTrickWinner={lastTrickWinner}
          trickNumber={trickNumber}
        />

        {errorMessage && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-team1 text-white text-xs font-bold px-4 py-2 rounded-full shadow-card animate-pop-in">
            {errorMessage}
          </div>
        )}
      </div>

      <div className="border-t border-brass-500/20 bg-felt-950/40 pt-1">
        <PlayerHand hand={hand} isMyTurn={isMyTurn} leadSuit={leadSuit} onPlay={playCard} />
      </div>
    </div>
  );
}
