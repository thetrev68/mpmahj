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
import { MahjongConfirmationDialog } from '../MahjongConfirmationDialog';
import { MahjongValidationDialog } from '../MahjongValidationDialog';
import { DeadHandOverlay } from '../DeadHandOverlay';
import { JokerExchangeDialog } from '../JokerExchangeDialog';
import type { ExchangeOpportunity } from '../JokerExchangeDialog';
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
  const [showMahjongDialog, setShowMahjongDialog] = useState(false);
  const [mahjongDialogLoading, setMahjongDialogLoading] = useState(false);
  const [mahjongDeclaredMessage, setMahjongDeclaredMessage] = useState<string | null>(null);
  const [deadHandNotice, setDeadHandNotice] = useState<string | null>(null);
  // US-020: persistent dead hand tracking (survives turn changes)
  // Initialize from server snapshot so reconnects restore dead-hand state (AC-10)
  const [deadHandPlayers, setDeadHandPlayers] = useState<Set<Seat>>(
    () => new Set(gameState.players.filter((p) => p.status === 'Dead').map((p) => p.seat))
  );
  // Ref mirrors state so eventBus closure (dep=[eventBus]) always reads the latest set (EC-1, AC-3)
  const deadHandPlayersRef = useRef<Set<Seat>>(
    new Set(gameState.players.filter((p) => p.status === 'Dead').map((p) => p.seat))
  );
  const [showDeadHandOverlay, setShowDeadHandOverlay] = useState(false);
  const [deadHandOverlayData, setDeadHandOverlayData] = useState<{
    player: Seat;
    reason: string;
  } | null>(null);
  // US-019: called-discard Mahjong validation state
  const [awaitingMahjongValidation, setAwaitingMahjongValidation] = useState<{
    calledTile: Tile;
    discardedBy: Seat;
  } | null>(null);
  const [awaitingValidationLoading, setAwaitingValidationLoading] = useState(false);

  // US-014/015: Joker exchange state
  const [showJokerExchangeDialog, setShowJokerExchangeDialog] = useState(false);
  const [jokerExchangeLoading, setJokerExchangeLoading] = useState(false);

  // Auto-draw retry state
  type DrawStatus = null | 'drawing' | { retrying: number } | 'failed';
  const [drawStatus, setDrawStatus] = useState<DrawStatus>(null);
  const drawRetryRef = useRef<{ count: number; cleared: boolean }>({ count: 0, cleared: false });

  // Determine if it's the current player's turn
  const isMyTurn = currentTurn === gameState.your_seat;

  // Determine if player is in discarding stage
  const isDiscardingStage = typeof turnStage === 'object' && 'Discarding' in turnStage && isMyTurn;

  // Mahjong can be declared when discarding with a full 14-tile hand (dead hand players cannot)
  const canDeclareMahjong =
    isDiscardingStage &&
    gameState.your_hand.length === 14 &&
    !deadHandPlayers.has(gameState.your_seat);

  // US-014/015: Calculate joker exchange opportunities
  const jokerExchangeOpportunities = useMemo((): ExchangeOpportunity[] => {
    if (!isDiscardingStage) return [];

    const opportunities: ExchangeOpportunity[] = [];
    const myTiles = new Set(gameState.your_hand);

    // Check each opponent's exposed melds
    for (const player of gameState.players) {
      if (player.seat === gameState.your_seat) continue; // Skip my own melds

      player.exposed_melds.forEach((meld, meldIndex) => {
        // Check joker_assignments for this meld
        Object.entries(meld.joker_assignments).forEach(([posStr, representedTile]) => {
          if (representedTile === undefined) return; // Skip if no represented tile
          const tilePosition = parseInt(posStr, 10);
          // If I have the matching tile in my hand, this is an exchange opportunity
          if (myTiles.has(representedTile)) {
            opportunities.push({
              targetSeat: player.seat,
              meldIndex,
              tilePosition,
              representedTile,
            });
          }
        });
      });
    }

    return opportunities;
  }, [isDiscardingStage, gameState.players, gameState.your_hand, gameState.your_seat]);

  const canExchangeJoker = jokerExchangeOpportunities.length > 0;

  const handleOpenJokerExchange = useCallback(() => {
    setShowJokerExchangeDialog(true);
  }, []);

  const handleJokerExchange = useCallback(
    (opportunity: ExchangeOpportunity) => {
      setJokerExchangeLoading(true);
      sendCommand({
        ExchangeJoker: {
          player: gameState.your_seat,
          target_seat: opportunity.targetSeat,
          meld_index: opportunity.meldIndex,
          replacement: opportunity.representedTile,
        },
      });
    },
    [sendCommand, gameState.your_seat]
  );

  const handleCloseJokerExchange = useCallback(() => {
    setShowJokerExchangeDialog(false);
    setJokerExchangeLoading(false);
  }, []);

  const handleDeclareMahjong = useCallback(() => {
    setShowMahjongDialog(true);
  }, []);

  const handleMahjongConfirm = useCallback(
    (command: import('@/types/bindings/generated/GameCommand').GameCommand) => {
      setMahjongDialogLoading(true);
      playing.setProcessing(true); // AC-3: disable hand while waiting for server validation
      sendCommand(command);
    },
    [sendCommand, playing]
  );

  const handleMahjongCancel = useCallback(() => {
    setShowMahjongDialog(false);
    setMahjongDialogLoading(false);
  }, []);

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
          // Dead hand players cannot call (US-020 EC-1, AC-3)
          // Use ref so stale closure always reads the latest set
          if (!deadHandPlayersRef.current.has(gameState.your_seat)) {
            callWindow.openCallWindow(action.params);
          }
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
        case 'SET_MAHJONG_DECLARED':
          setMahjongDeclaredMessage(`${action.player} is declaring Mahjong...`);
          break;
        case 'SET_AWAITING_MAHJONG_VALIDATION':
          setAwaitingMahjongValidation({
            calledTile: action.calledTile,
            discardedBy: action.discardedBy,
          });
          break;
        case 'SET_MAHJONG_VALIDATED':
          setMahjongDialogLoading(false);
          setAwaitingValidationLoading(false);
          setAwaitingMahjongValidation(null);
          setMahjongDeclaredMessage(null); // Clear announcing banner once server responds
          if (!action.valid) {
            setShowMahjongDialog(false);
            playing.setProcessing(false); // Allow discard again after invalid claim
            setDeadHandNotice(`Invalid Mahjong - Hand does not match any pattern`);
          }
          // On valid: keep isProcessing=true (hand stays locked, game proceeds to scoring)
          break;
        case 'SET_HAND_DECLARED_DEAD': {
          // AC-3: specific message for local player; generic for others
          const isLocalPlayer = action.player === gameState.your_seat;
          setDeadHandNotice(
            isLocalPlayer
              ? 'You have a dead hand. You will be skipped for the rest of the game.'
              : `${action.player}'s hand is declared dead: ${action.reason}`
          );
          // Persist dead hand for this player for the rest of the game (US-020 AC-3)
          setDeadHandPlayers((prev) => {
            const next = new Set([...prev, action.player]);
            deadHandPlayersRef.current = next; // keep ref in sync
            return next;
          });
          // Show acknowledgeable overlay only to the penalized player (US-020 AC-2)
          if (isLocalPlayer) {
            setDeadHandOverlayData({ player: action.player, reason: action.reason });
            setShowDeadHandOverlay(true);
          }
          break;
        }
        case 'SET_PLAYER_SKIPPED':
          setDeadHandNotice(`${action.player}'s turn was skipped (${action.reason})`);
          break;
        case 'SET_JOKER_EXCHANGED':
          // Close the joker exchange dialog and reset loading state
          setShowJokerExchangeDialog(false);
          setJokerExchangeLoading(false);
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
      {/* Turn Indicator (dead hand badges shown for all dead-hand players - US-020 AC-5) */}
      <TurnIndicator
        currentSeat={currentTurn}
        stage={turnStage}
        isMyTurn={isMyTurn}
        deadHandSeats={Array.from(deadHandPlayers)}
      />

      {/* Draw retry / failure feedback (initial "drawing" status shown by ActionBar) */}
      {isMyTurn && isDrawingStage && drawStatus !== null && drawStatus !== 'drawing' && (
        <div
          className="fixed top-[135px] left-1/2 -translate-x-1/2 bg-red-900/80 text-red-100 text-sm px-4 py-2 rounded"
          role="alert"
        >
          {drawStatus !== null &&
            typeof drawStatus === 'object' &&
            `Failed to draw tile. Retrying... ${drawStatus.retrying}/3`}
          {drawStatus === 'failed' && 'Failed to draw tile after 3 attempts. Please refresh.'}
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
          canDeclareMahjong={canDeclareMahjong}
          onDeclareMahjong={handleDeclareMahjong}
          canExchangeJoker={canExchangeJoker}
          onExchangeJoker={handleOpenJokerExchange}
          onCommand={(cmd) => {
            sendCommand(cmd);
            if ('DiscardTile' in cmd) {
              playing.setProcessing(true);
              clearSelection();
            }
          }}
        />
      </div>

      {/* Mahjong Confirmation Dialog (self-draw) */}
      <MahjongConfirmationDialog
        isOpen={showMahjongDialog}
        hand={gameState.your_hand}
        mySeat={gameState.your_seat}
        isLoading={mahjongDialogLoading}
        onConfirm={handleMahjongConfirm}
        onCancel={handleMahjongCancel}
      />

      {/* Mahjong Validation Dialog (called discard - US-019) */}
      <MahjongValidationDialog
        isOpen={awaitingMahjongValidation !== null}
        concealedHand={gameState.your_hand}
        calledTile={awaitingMahjongValidation?.calledTile ?? 0}
        discardedBy={awaitingMahjongValidation?.discardedBy ?? 'East'}
        mySeat={gameState.your_seat}
        isLoading={awaitingValidationLoading}
        onSubmit={(command) => {
          setAwaitingValidationLoading(true);
          playing.setProcessing(true);
          sendCommand(command);
        }}
      />

      {/* Joker Exchange Dialog (US-014/015) */}
      <JokerExchangeDialog
        isOpen={showJokerExchangeDialog}
        opportunities={jokerExchangeOpportunities}
        isLoading={jokerExchangeLoading}
        onExchange={handleJokerExchange}
        onClose={handleCloseJokerExchange}
      />

      {/* AC-1: Mahjong opportunity message when player has 14-tile winning hand */}
      {canDeclareMahjong && !showMahjongDialog && (
        <div
          className="fixed top-[100px] left-1/2 -translate-x-1/2 bg-yellow-900/90 border border-yellow-400 text-yellow-100 px-5 py-2 rounded-lg text-sm text-center z-30"
          data-testid="mahjong-opportunity-message"
          aria-live="polite"
        >
          You have Mahjong! Declare to win or discard to continue.
        </div>
      )}

      {/* Mahjong Declared Announcement (shown to all players) */}
      {mahjongDeclaredMessage && (
        <div
          className="fixed top-1/4 left-1/2 -translate-x-1/2 bg-yellow-900/90 border border-yellow-500 text-yellow-200 px-6 py-3 rounded-lg text-center z-40"
          data-testid="mahjong-declared-message"
          aria-live="polite"
        >
          {mahjongDeclaredMessage}
        </div>
      )}

      {/* Dead Hand Notice */}
      {deadHandNotice && (
        <div
          className="fixed top-1/3 left-1/2 -translate-x-1/2 bg-red-900/90 border border-red-500 text-red-200 px-6 py-3 rounded-lg text-center z-40"
          data-testid="dead-hand-notice"
          aria-live="assertive"
        >
          {deadHandNotice}
        </div>
      )}

      {/* Dead Hand Overlay (AC-2: shown to penalized player with acknowledge button) */}
      <DeadHandOverlay
        show={showDeadHandOverlay && deadHandOverlayData !== null}
        player={deadHandOverlayData?.player ?? 'East'}
        reason={deadHandOverlayData?.reason ?? ''}
        revealedHand={gameState.your_hand}
        onAcknowledge={() => setShowDeadHandOverlay(false)}
      />

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
