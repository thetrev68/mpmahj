/**
 * PlayingPhase Component
 *
 * Self-contained orchestrator for the Playing phase (main game loop).
 * Extracted from GameBoard.tsx as part of Phase 3 refactoring.
 *
 * Related: GAMEBOARD_REFACTORING_PLAN.md Phase 3
 */

import { useEffect, useCallback, useMemo, useState, useRef } from 'react';
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
import { getTileName } from '@/lib/utils/tileUtils';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { TurnStage } from '@/types/bindings/generated/TurnStage';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { Tile } from '@/types/bindings/generated/Tile';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { UIStateAction } from '@/lib/game-events/types';

export interface PlayingPhaseProps {
  gameState: GameStateSnapshot;
  turnStage: TurnStage;
  currentTurn: Seat;
  sendCommand: (cmd: GameCommand) => void;
  eventBus?: {
    on: (event: string, handler: (data: unknown) => void) => () => void;
  };
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
  eventBus,
}: PlayingPhaseProps) {
  const callWindow = useCallWindowState();
  const playing = usePlayingPhaseState();
  const animations = useGameAnimations();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-draw retry state
  type DrawStatus = null | 'drawing' | { retrying: number } | 'failed';
  const [drawStatus, setDrawStatus] = useState<DrawStatus>(null);
  const drawRetryRef = useRef<{ count: number; cleared: boolean }>({ count: 0, cleared: false });

  // Determine if it's the current player's turn
  const isMyTurn = currentTurn === gameState.your_seat;

  // Determine if player is in discarding stage
  const isDiscardingStage = typeof turnStage === 'object' && 'Discarding' in turnStage && isMyTurn;

  // Tile selection for discarding
  const { selectedIds, toggleTile, clearSelection } = useTileSelection({
    maxSelection: 1,
    disabledIds: [],
  });

  // Subscribe to event bus UI actions
  useEffect(() => {
    if (!eventBus) return;

    const unsub = eventBus.on('ui-action', (data: unknown) => {
      const action = data as UIStateAction;
      switch (action.type) {
        case 'OPEN_CALL_WINDOW':
          callWindow.openCallWindow(action.params);
          break;
        case 'UPDATE_CALL_WINDOW_PROGRESS':
          callWindow.updateProgress(action.canAct, action.intents);
          break;
        case 'CLOSE_CALL_WINDOW':
          callWindow.closeCallWindow();
          break;
        case 'MARK_CALL_WINDOW_RESPONDED':
          callWindow.markResponded(action.message);
          break;
        case 'SHOW_RESOLUTION_OVERLAY':
          playing.showResolutionOverlay(action.data);
          break;
        case 'DISMISS_RESOLUTION_OVERLAY':
          playing.dismissResolutionOverlay();
          break;
        case 'SET_MOST_RECENT_DISCARD':
          playing.setMostRecentDiscard(action.tile);
          break;
        case 'SET_DISCARD_ANIMATION_TILE':
          playing.setDiscardAnimation(action.tile);
          break;
        case 'SET_IS_PROCESSING':
          playing.setProcessing(action.value);
          break;
        case 'SET_INCOMING_FROM_SEAT':
          animations.setIncomingFromSeat(action.seat, 1500);
          break;
        case 'CLEAR_SELECTION':
          clearSelection();
          break;
        case 'SET_ERROR_MESSAGE':
          setErrorMessage(action.message);
          break;
        case 'CLEAR_PENDING_DRAW_RETRY':
          drawRetryRef.current.cleared = true;
          setDrawStatus(null);
          break;
        default:
          break;
      }
    });

    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventBus]);

  // Reset state on turn change
  useEffect(() => {
    playing.reset();
    animations.clearAllAnimations();
    clearSelection();
    setDrawStatus(null);
    drawRetryRef.current = { count: 0, cleared: false };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTurn]);

  // Auto-draw tile when it's my turn and stage is Drawing
  const isDrawingStage = typeof turnStage === 'object' && 'Drawing' in turnStage;
  useEffect(() => {
    if (!isMyTurn || !isDrawingStage) return;

    drawRetryRef.current = { count: 0, cleared: false };
    setDrawStatus('drawing');

    const sendDraw = () => {
      sendCommand({ DrawTile: { player: gameState.your_seat } });
    };

    const MAX_RETRIES = 3;
    const scheduleRetry = (attempt: number) => {
      return setTimeout(() => {
        if (drawRetryRef.current.cleared) return;
        const retryNum = attempt + 1;
        setDrawStatus({ retrying: retryNum });
        sendDraw();
        if (retryNum >= MAX_RETRIES) {
          // Final retry sent – show failure
          setDrawStatus('failed');
        } else {
          retryTimerRef.current = scheduleRetry(attempt + 1);
        }
      }, 5000);
    };

    const retryTimerRef = { current: 0 as ReturnType<typeof setTimeout> };

    const initialTimer = setTimeout(() => {
      if (drawRetryRef.current.cleared) return;
      sendDraw();
      retryTimerRef.current = scheduleRetry(0);
    }, 500);

    return () => {
      clearTimeout(initialTimer);
      clearTimeout(retryTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMyTurn, isDrawingStage]);

  // Call window timer countdown effect (includes auto-pass on expiry)
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

      // Auto-pass when timer expires and player hasn't responded
      if (remainingMs === 0 && !callWindow.callWindow!.hasResponded) {
        sendCommand({ Pass: { player: gameState.your_seat } });
        callWindow.markResponded('Time expired - auto-passed');
      }
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
        callWindow.markResponded('Declared Mahjong');
        return;
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

      callWindow.markResponded(`Declared intent to call for ${intent}`);
    },
    [callWindow, gameState.your_seat, gameState.your_hand, sendCommand]
  );

  // Handle pass on call
  const handlePass = useCallback(() => {
    if (!callWindow.callWindow || callWindow.callWindow.hasResponded) return;

    const tile = callWindow.callWindow.tile;
    sendCommand({
      Pass: {
        player: gameState.your_seat,
      },
    });

    const message = `Passed on ${getTileName(tile)}`;
    setErrorMessage(message);
    callWindow.closeCallWindow();
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

      {/* Draw retry / failure feedback (initial "drawing" status shown by ActionBar) */}
      {isMyTurn && isDrawingStage && drawStatus !== null && drawStatus !== 'drawing' && (
        <div
          className="fixed top-[135px] left-1/2 -translate-x-1/2 bg-red-900/80 text-red-100 text-sm px-4 py-2 rounded"
          role="alert"
        >
          {drawStatus !== null && typeof drawStatus === 'object' &&
            `Failed to draw tile. Retrying... ${drawStatus.retrying}/3`}
          {drawStatus === 'failed' &&
            'Failed to draw tile after 3 attempts. Please refresh.'}
        </div>
      )}

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

      {/* Error / status message */}
      {errorMessage && (
        <div
          className="fixed top-[135px] left-1/2 -translate-x-1/2 bg-gray-900/80 text-white text-sm px-4 py-2 rounded"
          role="alert"
        >
          {errorMessage}
        </div>
      )}
    </>
  );
}
