/**
 * CharlestonPhase Component
 *
 * Self-contained orchestrator for the Charleston tile-passing phase.
 * Extracted from GameBoard.tsx as part of Phase 2 refactoring.
 *
 * Related: GAMEBOARD_REFACTORING_PLAN.md Phase 2, US-005 (Charleston Voting)
 */

import { useEffect, useCallback } from 'react';
import { CharlestonTracker } from '../CharlestonTracker';
import { BlindPassPanel } from '../BlindPassPanel';
import { ConcealedHand } from '../ConcealedHand';
import { ActionBar } from '../ActionBar';
import { VotingPanel } from '../VotingPanel';
import { VoteResultOverlay } from '../VoteResultOverlay';
import { PassAnimationLayer } from '../PassAnimationLayer';
import { useCharlestonState } from '@/hooks/useCharlestonState';
import { useGameAnimations } from '@/hooks/useGameAnimations';
import { useTileSelection } from '@/hooks/useTileSelection';
import { TILE_INDICES } from '@/lib/utils/tileUtils';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { CharlestonStage } from '@/types/bindings/generated/CharlestonStage';
import type { CharlestonVote } from '@/types/bindings/generated/CharlestonVote';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { Tile } from '@/types/bindings/generated/Tile';

export interface CharlestonPhaseProps {
  gameState: GameStateSnapshot;
  stage: CharlestonStage;
  sendCommand: (cmd: GameCommand) => void;
}

/**
 * Charleston phase component
 *
 * Manages all Charleston phase UI and interactions:
 * - Tile selection and passing (with blind pass support)
 * - Charleston stage tracking
 * - Timer display
 * - Voting panel
 * - Vote result overlay
 * - Pass animations
 *
 * @example
 * ```tsx
 * <CharlestonPhase
 *   gameState={gameState}
 *   stage="FirstRight"
 *   sendCommand={(cmd) => ws.send(JSON.stringify({ kind: 'Command', payload: cmd }))}
 * />
 * ```
 */
export function CharlestonPhase({ gameState, stage, sendCommand }: CharlestonPhaseProps) {
  const charleston = useCharlestonState();
  const animations = useGameAnimations();

  // Determine if this is a blind pass stage
  const isBlindPassStage = stage === 'FirstLeft' || stage === 'SecondRight';
  const isVotingStage = stage === 'VotingToContinue';

  // Tile selection configuration
  const handMaxSelection = isBlindPassStage ? 3 - charleston.blindPassCount : 3;

  const { selectedIds, toggleTile, clearSelection } = useTileSelection({
    maxSelection: handMaxSelection,
    disabledIds: gameState.your_hand
      .map((tile, idx) => ({ id: `${tile}-${idx}`, tile }))
      .filter((t) => t.tile === TILE_INDICES.JOKER)
      .map((t) => t.id),
  });

  // Reset state on stage change
  useEffect(() => {
    charleston.reset();
    animations.clearAllAnimations();
    clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // Timer countdown effect
  useEffect(() => {
    if (!charleston.timer) {
      charleston.setTimerRemaining(null);
      return;
    }

    const updateRemaining = () => {
      const now = Date.now();
      const remainingMs = Math.max(0, charleston.timer!.expiresAtMs - now);
      charleston.setTimerRemaining(Math.ceil(remainingMs / 1000));
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 500);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charleston.timer]);

  // Handle vote command
  const handleVote = useCallback(
    (vote: CharlestonVote) => {
      sendCommand({
        VoteCharleston: { player: gameState.your_seat, vote },
      });
      charleston.submitVote(vote);
    },
    [sendCommand, gameState.your_seat, charleston]
  );

  return (
    <>
      {/* Charleston Tracker */}
      <CharlestonTracker
        stage={stage}
        readyPlayers={charleston.readyPlayers}
        timer={
          charleston.timer && charleston.timerRemaining !== null
            ? {
                remainingSeconds: charleston.timerRemaining,
                durationSeconds: charleston.timer.durationSeconds,
                mode: charleston.timer.mode,
              }
            : null
        }
        statusMessage={charleston.messages.botPass || undefined}
      />

      {/* Error Message */}
      {charleston.messages.error && (
        <div
          className="fixed top-[135px] left-1/2 -translate-x-1/2 bg-red-900/80 text-red-100 text-sm px-4 py-2 rounded"
          role="alert"
        >
          {charleston.messages.error}
        </div>
      )}

      {/* Blind Pass Panel */}
      {isBlindPassStage && !charleston.hasSubmittedPass && (
        <BlindPassPanel
          blindCount={charleston.blindPassCount}
          onBlindCountChange={(count) => {
            charleston.setBlindPassCount(count);
            if (selectedIds.length > 3 - count) {
              clearSelection();
            }
          }}
          handSelectionCount={selectedIds.length}
          totalRequired={3}
          disabled={charleston.hasSubmittedPass}
        />
      )}

      {/* Concealed Hand (if not voting) */}
      {!isVotingStage && (
        <ConcealedHand
          tiles={gameState.your_hand.map((tile, idx) => ({
            id: `${tile}-${idx}`,
            tile,
          }))}
          mode="charleston"
          selectedTileIds={selectedIds}
          onTileSelect={toggleTile}
          maxSelection={handMaxSelection}
          disabled={charleston.hasSubmittedPass || isVotingStage}
          disabledTileIds={gameState.your_hand
            .map((tile, idx) => ({ id: `${tile}-${idx}`, tile }))
            .filter((t) => t.tile === TILE_INDICES.JOKER)
            .map((t) => t.id)}
          highlightedTileIds={animations.highlightedTileIds}
          incomingFromSeat={animations.incomingFromSeat}
          leavingTileIds={animations.leavingTileIds}
          blindPassCount={isBlindPassStage ? charleston.blindPassCount : undefined}
        />
      )}

      {/* Action Bar */}
      <ActionBar
        phase={{ Charleston: stage }}
        mySeat={gameState.your_seat}
        selectedTiles={selectedIds
          .map((id) => parseInt(id.split('-')[0]))
          .filter((t): t is Tile => !isNaN(t))}
        isProcessing={false}
        blindPassCount={isBlindPassStage ? charleston.blindPassCount : undefined}
        hasSubmittedPass={charleston.hasSubmittedPass}
        onCommand={(cmd) => {
          sendCommand(cmd);
          if ('PassTiles' in cmd) {
            charleston.submitPass();
          }
        }}
      />

      {/* Voting Panel */}
      {isVotingStage && (
        <VotingPanel
          onVote={handleVote}
          disabled={charleston.voting.hasSubmitted}
          hasVoted={charleston.voting.hasSubmitted}
          myVote={charleston.voting.myVote || undefined}
          voteCount={charleston.voting.votedPlayers.length}
          totalPlayers={4}
          votedPlayers={charleston.voting.votedPlayers}
          allPlayers={gameState.players.map((p) => ({
            seat: p.seat,
            is_bot: p.is_bot,
          }))}
          botVoteMessage={charleston.messages.botVote || undefined}
        />
      )}

      {/* Vote Result Overlay */}
      {charleston.voting.showResultOverlay && charleston.voting.result && (
        <VoteResultOverlay
          result={charleston.voting.result}
          votes={charleston.voting.breakdown || undefined}
          onDismiss={charleston.dismissVoteResult}
          myVote={charleston.voting.myVote || undefined}
        />
      )}

      {/* Pass Animation Layer */}
      {animations.passDirection && <PassAnimationLayer direction={animations.passDirection} />}
    </>
  );
}
