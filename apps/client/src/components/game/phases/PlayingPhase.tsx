/**
 * PlayingPhase Component
 *
 * Self-contained orchestrator for the Playing phase (main game loop).
 * Extracted from GameBoard.tsx as part of Phase 3 refactoring.
 *
 * Related: GAMEBOARD_REFACTORING_PLAN.md Phase 3
 */

import { useEffect, useCallback, useMemo } from 'react';
import { TurnIndicator } from '../TurnIndicator';
import { DiscardPool } from '../DiscardPool';
import { DiscardAnimationLayer } from '../DiscardAnimationLayer';
import { CallWindowPanel } from '../CallWindowPanel';
import { CallResolutionOverlay } from '../CallResolutionOverlay';
import { ExposedMeldsArea } from '../ExposedMeldsArea';
import { ConcealedHand } from '../ConcealedHand';
import { ActionBar } from '../ActionBar';
import { useCallWindowState } from '@/hooks/useCallWindowState';
import { usePlayingPhaseState } from '@/hooks/usePlayingPhaseState';
import { useGameAnimations } from '@/hooks/useGameAnimations';
import { useTileSelection } from '@/hooks/useTileSelection';
import { calculateCallIntent } from '@/lib/game-logic/callIntentCalculator';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { TurnStage } from '@/types/bindings/generated/TurnStage';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { Tile } from '@/types/bindings/generated/Tile';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';

export interface PlayingPhaseProps {
  gameState: GameStateSnapshot;
  turnStage: TurnStage;
  currentTurn: Seat;
  sendCommand: (cmd: GameCommand) => void;
}

/**
 * PlayingPhase component
 *
 * Manages all Playing phase UI and interactions:
 * - Turn indicator
 * - Discard pool display
 * - Call window (declare intent, pass)
 * - Call resolution overlay
 * - Exposed melds display
 * - Concealed hand (discard mode)
 * - Action bar (discard, declare mahjong)
 * - Discard animation
 *
 * @example
 * ```tsx
 * <PlayingPhase
 *   gameState={gameState}
 *   turnStage={{ Discarding: 'East' }}
 *   currentTurn="East"
 *   sendCommand={(cmd) => ws.send(JSON.stringify({ kind: 'Command', payload: cmd }))}
 * />
 * ```
 */
export function PlayingPhase({
  gameState,
  turnStage,
  currentTurn,
  sendCommand,
}: PlayingPhaseProps) {
  const callWindow = useCallWindowState();
  const playing = usePlayingPhaseState();
  const animations = useGameAnimations();

  // Determine if it's the current player's turn
  const isMyTurn = currentTurn === gameState.your_seat;

  // Determine if player is in discarding stage
  const isDiscardingStage = typeof turnStage === 'object' && 'Discarding' in turnStage && isMyTurn;

  // Tile selection for discarding
  const { selectedIds, toggleTile, clearSelection } = useTileSelection({
    maxSelection: 1,
    disabledIds: [],
  });

  // Reset state on turn change
  useEffect(() => {
    playing.reset();
    animations.clearAllAnimations();
    clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTurn]);

  // Call window timer countdown effect
  useEffect(() => {
    if (!callWindow.callWindow) {
      callWindow.setTimerRemaining(null);
      return;
    }

    const updateRemaining = () => {
      const now = Date.now();
      const remainingMs = Math.max(
        0,
        callWindow.callWindow!.timerStart + callWindow.callWindow!.timerDuration * 1000 - now
      );
      callWindow.setTimerRemaining(Math.ceil(remainingMs / 1000));
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 500);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callWindow.callWindow]);

  // Calculate call eligibility based on current hand
  const callEligibility = useMemo(() => {
    if (!callWindow.callWindow) {
      return {
        canCallForPung: false,
        canCallForKong: false,
        canCallForQuint: false,
        canCallForSextet: false,
        canCallForMahjong: true, // Can always try for Mahjong
      };
    }

    const tile = callWindow.callWindow.tile;
    const tileCounts = new Map<Tile, number>();

    // Count tiles in hand
    for (const handTile of gameState.your_hand) {
      tileCounts.set(handTile, (tileCounts.get(handTile) || 0) + 1);
    }

    // Calculate eligibility for each meld type
    const pung = calculateCallIntent({ tile, tileCounts, intent: 'Pung' });
    const kong = calculateCallIntent({ tile, tileCounts, intent: 'Kong' });
    const quint = calculateCallIntent({ tile, tileCounts, intent: 'Quint' });
    const sextet = calculateCallIntent({ tile, tileCounts, intent: 'Sextet' });

    return {
      canCallForPung: pung.success,
      canCallForKong: kong.success,
      canCallForQuint: quint.success,
      canCallForSextet: sextet.success,
      canCallForMahjong: true, // Can always try for Mahjong
    };
  }, [callWindow.callWindow, gameState.your_hand]);

  // Handle call intent declaration
  const handleCallIntent = useCallback(
    (intent: 'Mahjong' | 'Pung' | 'Kong' | 'Quint' | 'Sextet') => {
      if (!callWindow.callWindow || callWindow.callWindow.hasResponded) return;

      const tile = callWindow.callWindow.tile;

      if (intent === 'Mahjong') {
        sendCommand({
          DeclareCallIntent: {
            player: gameState.your_seat,
            intent: 'Mahjong',
          },
        });
      } else {
        const tileCounts = new Map<Tile, number>();
        for (const handTile of gameState.your_hand) {
          tileCounts.set(handTile, (tileCounts.get(handTile) || 0) + 1);
        }

        const result = calculateCallIntent({ tile, tileCounts, intent });

        if (result.success && result.meldTiles) {
          sendCommand({
            DeclareCallIntent: {
              player: gameState.your_seat,
              intent: {
                Meld: {
                  meld_type: intent,
                  tiles: result.meldTiles,
                  called_tile: tile,
                  joker_assignments: {},
                },
              },
            },
          });
        }
      }

      callWindow.markResponded(`Called for ${intent}`);
    },
    [callWindow, gameState.your_seat, gameState.your_hand, sendCommand]
  );

  // Handle pass on call
  const handlePass = useCallback(() => {
    if (!callWindow.callWindow || callWindow.callWindow.hasResponded) return;

    sendCommand({
      Pass: {
        player: gameState.your_seat,
      },
    });

    callWindow.markResponded('Passed');
  }, [callWindow, gameState.your_seat, sendCommand]);

  // Handle discard animation completion
  const handleDiscardAnimationComplete = useCallback(() => {
    playing.setDiscardAnimation(null);
  }, [playing]);

  // Handle resolution overlay dismiss
  const handleResolutionDismiss = useCallback(() => {
    playing.dismissResolutionOverlay();
  }, [playing]);

  return (
    <>
      {/* Turn Indicator */}
      <TurnIndicator currentSeat={currentTurn} stage={turnStage} isMyTurn={isMyTurn} />

      {/* Discard Pool */}
      <DiscardPool
        discards={gameState.discard_pile.map((d, index) => ({
          tile: d.tile,
          discardedBy: d.discarded_by,
          turn: index + 1,
        }))}
        mostRecentTile={playing.mostRecentDiscard ?? undefined}
        callableTile={callWindow.callWindow?.tile}
      />

      {/* Exposed Melds (for each player) */}
      {gameState.players.map((player) => (
        <ExposedMeldsArea
          key={player.seat}
          melds={player.exposed_melds}
          compact={player.seat !== gameState.your_seat}
          ownerSeat={player.seat}
        />
      ))}

      {/* Concealed Hand */}
      <ConcealedHand
        tiles={gameState.your_hand.map((tile, idx) => ({
          id: `${tile}-${idx}`,
          tile,
        }))}
        mode="discard"
        selectedTileIds={selectedIds}
        onTileSelect={toggleTile}
        maxSelection={1}
        disabled={!isDiscardingStage || playing.isProcessing}
        highlightedTileIds={animations.highlightedTileIds}
        incomingFromSeat={animations.incomingFromSeat}
        leavingTileIds={animations.leavingTileIds}
      />

      {/* Action Bar */}
      <div role="group" aria-label="action bar">
        <ActionBar
          phase={{ Playing: turnStage }}
          mySeat={gameState.your_seat}
          selectedTiles={selectedIds
            .map((id) => parseInt(id.split('-')[0]))
            .filter((t): t is Tile => !isNaN(t))}
          isProcessing={playing.isProcessing}
          onCommand={(cmd) => {
            sendCommand(cmd);
            if ('Discard' in cmd) {
              playing.setProcessing(true);
              clearSelection();
            }
          }}
        />
      </div>

      {/* Call Window Panel */}
      {callWindow.callWindow && (
        <CallWindowPanel
          callableTile={callWindow.callWindow.tile}
          discardedBy={callWindow.callWindow.discardedBy}
          canCallForPung={callEligibility.canCallForPung}
          canCallForKong={callEligibility.canCallForKong}
          canCallForQuint={callEligibility.canCallForQuint}
          canCallForSextet={callEligibility.canCallForSextet}
          canCallForMahjong={callEligibility.canCallForMahjong}
          onCallIntent={handleCallIntent}
          onPass={handlePass}
          timerRemaining={callWindow.timerRemaining ?? callWindow.callWindow.timerDuration}
          timerDuration={callWindow.callWindow.timerDuration}
          disabled={callWindow.callWindow.hasResponded}
          responseMessage={callWindow.callWindow.responseMessage}
          respondedSeats={
            callWindow.callWindow.canCall.filter(
              (seat) => !callWindow.callWindow!.canAct.includes(seat)
            ) || []
          }
          intentSummaries={callWindow.callWindow.intents}
        />
      )}

      {/* Call Resolution Overlay */}
      {playing.resolutionOverlay && (
        <CallResolutionOverlay
          resolution={playing.resolutionOverlay.resolution}
          tieBreak={playing.resolutionOverlay.tieBreak}
          allCallers={playing.resolutionOverlay.allCallers}
          discardedBy={playing.resolutionOverlay.discardedBy}
          onDismiss={handleResolutionDismiss}
        />
      )}

      {/* Discard Animation Layer */}
      {playing.discardAnimationTile !== null && (
        <DiscardAnimationLayer
          tile={playing.discardAnimationTile}
          onComplete={handleDiscardAnimationComplete}
        />
      )}
    </>
  );
}
