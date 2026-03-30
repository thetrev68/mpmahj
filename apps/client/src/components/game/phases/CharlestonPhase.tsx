/**
 * @module CharlestonPhase
 *
 * Self-contained orchestrator for the Charleston tile-passing phase where players exchange
 * tiles before the main game begins. Extracted from GameBoard as phase-specific component.
 *
 * Complex state machine with 6 stages (per NMJL rules):
 * 1. **FirstRight** → 2. **FirstAcross** → 3. **FirstLeft** → 4. **Voting** (stop?) →
 * 5. **SecondLeft** → 6. **SecondAcross** (optional courtesy pass)
 *
 * Key features:
 * - **Tile selection**: Choose tiles to pass (1–3 depending on stage and blind pass rules)
 * - **Blind pass/steal**: On last pass, can exchange fewer tiles or steal from others
 * - **Animation**: Direction indicators (Right/Across/Left) with animated overlays
 * - **Voting**: Stop vote between first and second Charleston (majority or unanimous)
 * - **IOU tracking**: Tracks tile "debts" from blind trades
 * - **Courtesy pass**: Optional across-only exchange (0–3 tiles) after Charleston ends
 * - **Timer**: Countdown per pass stage (configurable in house rules)
 * - **Character animation**: Animated hand highlight and incoming tile effects
 *
 * Phase 4, slice 4.4: All UI state is now read from the single gameUIStore authority.
 * The old eventBus ui-action subscription has been removed.
 *
 * @see `src/components/game/GameBoard.tsx` for game orchestration
 * @see `src/stores/gameUIStore.ts` for UI state
 * @see `src/components/game/PlayerRack.tsx` for tile selection UI
 */

import { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CharlestonTracker } from '../CharlestonTracker';
import { PlayerRack } from '../PlayerRack';
import { ActionBar } from '../ActionBar';
import { VoteResultOverlay } from '../VoteResultOverlay';
import { PassAnimationLayer } from '../PassAnimationLayer';
import { IOUOverlay } from '../IOUOverlay';
import { OpponentRack } from '../OpponentRack';
import { PlayerZone } from '../PlayerZone';
import { StagingStrip, type StagedTile } from '../StagingStrip';
import { MahjongConfirmationDialog } from '../MahjongConfirmationDialog';
import { getOpponentPosition } from '../opponentRackUtils';
import { BOARD_LAYERS } from '../boardLayers';
import { useMahjongDeclaration } from '@/hooks/useMahjongDeclaration';
import { useGameUIStore } from '@/stores/gameUIStore';
import { useAnimationSettings } from '@/hooks/useAnimationSettings';
import { useCountdown } from '@/hooks/useCountdown';
import { useTileSelection } from '@/hooks/useTileSelection';
import { getCharlestonVoteWaitingMessage } from '../ActionBarDerivations';
import { CHARLESTON_PASS_COUNT } from '@/lib/constants';
import { TILE_INDICES } from '@/lib/utils/tileUtils';
import { buildTileInstances, selectedIdsToTiles } from '@/lib/utils/tileSelection';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { CharlestonStage } from '@/types/bindings/generated/CharlestonStage';
import type { CharlestonVote } from '@/types/bindings/generated/CharlestonVote';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';

/**
 * Props for the CharlestonPhase component.
 *
 * @interface CharlestonPhaseProps
 * @property {GameStateSnapshot} gameState - Current game state snapshot from server.
 * @property {CharlestonStage} stage - Current Charleston stage.
 * @property {(cmd: GameCommand) => void} sendCommand - Callback to send commands.
 */
interface CharlestonPhaseProps {
  gameState: GameStateSnapshot;
  stage: CharlestonStage;
  sendCommand: (cmd: GameCommand) => void;
  isHistoricalView?: boolean;
  topChromeSlot?: HTMLElement | null;
}

/**
 * Charleston phase component.
 *
 * Reads all transient UI state from `useGameUIStore` (the single authority established in
 * Phase 4, slice 4.1). The old eventBus ui-action subscription has been fully removed.
 */
export function CharlestonPhase({
  gameState,
  stage,
  sendCommand,
  isHistoricalView = false,
  topChromeSlot = null,
}: CharlestonPhaseProps) {
  const dispatch = useGameUIStore((s) => s.dispatch);

  // ── Store state reads ─────────────────────────────────────────────────────

  // Pass tracking
  const storeReadyPlayers = useGameUIStore((s) => s.readyPlayers);
  const storeHasSubmittedPass = useGameUIStore((s) => s.hasSubmittedPass);
  const storeCharlestonTimer = useGameUIStore((s) => s.charlestonTimer);
  const storeBotPassMessage = useGameUIStore((s) => s.botPassMessage);
  const storePassDirection = useGameUIStore((s) => s.passDirection);
  const storeIncomingFromSeat = useGameUIStore((s) => s.incomingFromSeat);
  const storeHighlightedTileIds = useGameUIStore((s) => s.highlightedTileIds);
  const storeNewlyReceivedTileIds = useGameUIStore((s) => s.newlyReceivedTileIds);
  const storeLeavingTileIds = useGameUIStore((s) => s.leavingTileIds);
  const storeOpponentStagedCounts = useGameUIStore((s) => s.opponentStagedCounts);
  const storeStagedIncoming = useGameUIStore((s) => s.stagedIncoming);

  // Voting
  const storeHasSubmittedVote = useGameUIStore((s) => s.hasSubmittedVote);
  const storeMyVote = useGameUIStore((s) => s.myVote);
  const storeVotedPlayers = useGameUIStore((s) => s.votedPlayers);
  const storeVoteResult = useGameUIStore((s) => s.voteResult);
  const storeVoteBreakdown = useGameUIStore((s) => s.voteBreakdown);
  const storeShowVoteResultOverlay = useGameUIStore((s) => s.showVoteResultOverlay);
  const storeBotVoteMessage = useGameUIStore((s) => s.botVoteMessage);

  // IOU
  const storeIouState = useGameUIStore((s) => s.iouState);
  const storeDeadHandPlayers = useGameUIStore((s) => s.deadHandPlayers);

  // Courtesy pass (server-driven parts)
  const storeCourtesyAgreement = useGameUIStore((s) => s.courtesyAgreement);
  const storeCourtesyMismatch = useGameUIStore((s) => s.courtesyMismatch);

  // Error message
  const storeErrorMessage = useGameUIStore((s) => s.errorMessage);

  // Imperative signals (counter-based)
  const clearSelectionSignal = useGameUIStore((s) => s.clearSelectionSignal);
  const clearPendingVoteRetrySignal = useGameUIStore((s) => s.clearPendingVoteRetrySignal);
  const courtesyZeroSignal = useGameUIStore((s) => s.courtesyZeroSignal);

  // ── Animation settings ────────────────────────────────────────────────────
  const { isEnabled } = useAnimationSettings();
  const mahjong = useMahjongDeclaration({
    gameState,
    sendCommand,
    setPlayingProcessing: () => {},
  });

  // Stage-scoped optimistic flags. They auto-expire when the stage advances or when
  // store state confirms the server responded, avoiding effect-driven local resets.
  const [passSubmissionStage, setPassSubmissionStage] = useState<CharlestonStage | null>(null);
  const [courtesyPendingStage, setCourtesyPendingStage] = useState<CharlestonStage | null>(null);

  // Vote retry refs
  const pendingVoteRef = useRef<CharlestonVote | null>(null);
  const voteRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Derived values from store (courtesy pass negotiation) ─────────────────

  const negotiationType = useMemo((): 'agreement' | 'mismatch' | 'zero' | undefined => {
    // Mismatch (may be zero or non-zero agreed count)
    if (storeCourtesyMismatch !== null) {
      return storeCourtesyMismatch.agreedCount === 0 ? 'zero' : 'mismatch';
    }
    // Agreement
    if (storeCourtesyAgreement !== null) {
      return storeCourtesyAgreement === 0 ? 'zero' : 'agreement';
    }
    return undefined;
  }, [storeCourtesyAgreement, storeCourtesyMismatch]);

  const agreedCount: number = storeCourtesyMismatch?.agreedCount ?? storeCourtesyAgreement ?? 0;
  const votingStatusMessage =
    stage === 'VotingToContinue'
      ? storeBotVoteMessage ||
        (storeHasSubmittedVote && storeMyVote
          ? `You voted to ${storeMyVote.toUpperCase()} — waiting for other players`
          : undefined)
      : storeBotPassMessage || undefined;
  const votingWaitingMessage =
    stage === 'VotingToContinue' && !storeHasSubmittedVote
      ? getCharlestonVoteWaitingMessage(storeVotedPlayers, gameState.players.length)
      : undefined;

  const isSelectingTiles =
    negotiationType !== undefined && negotiationType !== 'zero' && agreedCount > 0;

  // ── Stage / phase flags ───────────────────────────────────────────────────

  const isBlindPassStage = stage === 'FirstLeft' || stage === 'SecondRight';
  const isVotingStage = stage === 'VotingToContinue';
  const isCourtesyStage = stage === 'CourtesyAcross';
  const hasRetryablePassError =
    storeErrorMessage !== null &&
    (/tile not in hand/i.test(storeErrorMessage) || /rate limit/i.test(storeErrorMessage));
  const passSubmissionInFlight =
    passSubmissionStage === stage && !storeHasSubmittedPass && !hasRetryablePassError;
  const isCourtesyWaiting =
    isCourtesyStage &&
    ((courtesyPendingStage === stage &&
      storeCourtesyAgreement === null &&
      storeCourtesyMismatch === null) ||
      negotiationType === 'zero');
  const isPassUiLocked = storeHasSubmittedPass || passSubmissionInFlight;
  const canDeclareMahjong =
    !isHistoricalView &&
    gameState.your_hand.length === 14 &&
    !storeDeadHandPlayers.some(({ player }) => player === gameState.your_seat);

  // ── Timer (computed locally from store timer) ─────────────────────────────

  const charlestonDeadlineMs = storeCharlestonTimer?.expiresAtMs ?? null;
  const charlestonSecondsRemaining = useCountdown({
    deadlineMs: charlestonDeadlineMs,
    intervalMs: 500,
  });

  // ── Hand computation ──────────────────────────────────────────────────────

  const serverHandTileInstances = useMemo(
    () => buildTileInstances(gameState.your_hand),
    [gameState.your_hand]
  );

  type DisplayStagedIncomingTile = StagedTile & { tileIndex: number };
  const stagedIncomingTiles = useMemo<DisplayStagedIncomingTile[]>(() => {
    if (storeStagedIncoming === null || storeStagedIncoming.context !== 'Charleston') {
      return [];
    }

    return storeStagedIncoming.tiles
      .map((tile, tileIndex) => ({
        id: `incoming-${storeStagedIncoming.stage}-${tileIndex}-${tile}`,
        tile,
        tileIndex,
        // US-058: blind stage tiles (from === null) are always face-down until the
        // player explicitly keeps them out of the outgoing blind bundle.
        hidden: storeStagedIncoming.from === null,
      }))
      .filter((tile) => !storeStagedIncoming.absorbedTileIndexes.includes(tile.tileIndex));
  }, [storeStagedIncoming]);

  const handTileInstances = serverHandTileInstances;

  const handMaxSelection =
    isCourtesyStage && isSelectingTiles ? agreedCount : CHARLESTON_PASS_COUNT;

  const { selectedIds, toggleTile, clearSelection } = useTileSelection({
    maxSelection: handMaxSelection,
    disabledIds: handTileInstances
      .filter((instance) => instance.tile === TILE_INDICES.JOKER)
      .map((t) => t.id),
  });

  const outgoingTiles = useMemo(
    () =>
      selectedIds
        .map((id) => handTileInstances.find((instance) => instance.id === id))
        .filter(
          (instance): instance is (typeof handTileInstances)[number] => instance !== undefined
        )
        .map((instance) => ({
          id: instance.id,
          tile: instance.tile,
        })),
    [handTileInstances, selectedIds]
  );

  const canCommitPass =
    !isVotingStage &&
    !isCourtesyStage &&
    !isPassUiLocked &&
    selectedIds.length + stagedIncomingTiles.length === 3;

  const selectedHandTiles = useMemo(
    () =>
      selectedIds
        .map((id) => {
          const instance = handTileInstances.find((candidate) => candidate.id === id);
          return instance?.tile;
        })
        .filter((tile): tile is number => tile !== undefined),
    [handTileInstances, selectedIds]
  );

  const handleCommitPass = useCallback(() => {
    if (!canCommitPass) {
      return;
    }

    setPassSubmissionStage(stage);
    sendCommand({
      CommitCharlestonPass: {
        player: gameState.your_seat,
        from_hand: selectedHandTiles,
        forward_incoming_count: stagedIncomingTiles.length,
      },
    });
  }, [
    canCommitPass,
    gameState.your_seat,
    selectedHandTiles,
    sendCommand,
    stage,
    stagedIncomingTiles.length,
  ]);

  // ── Signal: CLEAR_SELECTION ───────────────────────────────────────────────

  useEffect(() => {
    if (clearSelectionSignal > 0) clearSelection();
  }, [clearSelection, clearSelectionSignal]);

  // ── Signal: CLEAR_PENDING_VOTE_RETRY ─────────────────────────────────────

  useEffect(() => {
    if (clearPendingVoteRetrySignal > 0) {
      if (voteRetryTimerRef.current !== null) {
        clearTimeout(voteRetryTimerRef.current);
        voteRetryTimerRef.current = null;
      }
      pendingVoteRef.current = null;
    }
  }, [clearPendingVoteRetrySignal]);

  // ── Signal: SET_COURTESY_ZERO (auto-send AcceptCourtesyPass) ─────────────

  useEffect(() => {
    if (courtesyZeroSignal > 0) {
      sendCommand({ AcceptCourtesyPass: { player: gameState.your_seat, tiles: [] } });
    }
  }, [courtesyZeroSignal, gameState.your_seat, sendCommand]);

  // ── Reset selection when max shrinks ─────────────────────────────────────

  useEffect(() => {
    if (selectedIds.length > handMaxSelection) {
      clearSelection();
    }
  }, [clearSelection, handMaxSelection, selectedIds.length]);

  // ── Reset local state on stage change ────────────────────────────────────
  // Note: stagedIncomingTiles is NOT cleared here — incoming tiles from the
  // previous pass must survive the stage transition so the player can forward
  // them. The bridge effect (storeStagedIncoming) controls stagedIncomingTiles.

  useEffect(() => {
    clearSelection();
  }, [clearSelection, stage]);

  // ── Vote handling ─────────────────────────────────────────────────────────

  const handleVote = useCallback(
    (vote: CharlestonVote) => {
      sendCommand({
        VoteCharleston: { player: gameState.your_seat, vote },
      });
      dispatch({ type: 'SET_HAS_SUBMITTED_VOTE', value: true });
      dispatch({ type: 'SET_MY_VOTE', vote });
      clearSelection();
      pendingVoteRef.current = vote;

      // Start retry timer: if no PlayerVoted ack within 5s, retry
      if (voteRetryTimerRef.current !== null) clearTimeout(voteRetryTimerRef.current);
      voteRetryTimerRef.current = setTimeout(() => {
        if (pendingVoteRef.current === null) return;
        dispatch({ type: 'SET_ERROR_MESSAGE', message: 'Failed to submit vote. Retrying...' });
        sendCommand({
          VoteCharleston: { player: gameState.your_seat, vote: pendingVoteRef.current },
        });
        voteRetryTimerRef.current = null;
      }, 5000);
    },
    [sendCommand, gameState.your_seat, dispatch, clearSelection]
  );

  // ── Courtesy pass handling (US-007) ──────────────────────────────────────

  const canSubmitVote =
    isVotingStage &&
    !storeHasSubmittedVote &&
    (selectedIds.length === 0 || selectedIds.length === CHARLESTON_PASS_COUNT);

  const handleCourtesyProceed = useCallback(() => {
    if (isSelectingTiles) {
      const tiles = selectedIdsToTiles(selectedIds);

      if (tiles.length !== agreedCount) {
        dispatch({
          type: 'SET_ERROR_MESSAGE',
          message: `Must select exactly ${agreedCount} tiles`,
        });
        return;
      }

      sendCommand({
        AcceptCourtesyPass: { player: gameState.your_seat, tiles },
      });
      clearSelection();
      return;
    }

    sendCommand({
      ProposeCourtesyPass: { player: gameState.your_seat, tile_count: selectedIds.length },
    });
    setCourtesyPendingStage(stage);
  }, [
    agreedCount,
    clearSelection,
    dispatch,
    gameState.your_seat,
    isSelectingTiles,
    selectedIds,
    sendCommand,
    stage,
  ]);

  const opponentSlotClassByPosition: Record<'top' | 'left' | 'right', string> = {
    top: 'col-span-3 row-start-1 flex justify-center self-start',
    left: 'col-start-1 row-start-2 flex items-start justify-start self-start',
    right: 'col-start-3 row-start-2 flex items-start justify-end self-start',
  };

  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 px-3 pb-4 pt-1 lg:px-4 lg:pt-2"
        data-testid="charleston-board-regions"
      >
        <div
          className="grid h-full grid-cols-[minmax(var(--charleston-col-side),auto)_minmax(0,1fr)_minmax(var(--charleston-col-side),auto)] grid-rows-[auto_minmax(0,1fr)_auto] gap-x-3 gap-y-3 lg:gap-x-4 lg:gap-y-4"
          data-testid="charleston-board-frame"
        >
        {/* Opponent racks — face-down tiles for each opponent */}
        {gameState.players
          .filter((p) => p.seat !== gameState.your_seat)
          .map((p) => {
            const pos = getOpponentPosition(gameState.your_seat, p.seat);
            const posClass = opponentSlotClassByPosition[pos];
            return (
              <div
                key={`slot-${p.seat}`}
                className={posClass}
                data-testid={`opponent-slot-${p.seat.toLowerCase()}`}
                data-board-region={`opponent-${pos}`}
              >
                <OpponentRack
                  key={p.seat}
                  player={p}
                  yourSeat={gameState.your_seat}
                  charlestonReadyCount={storeOpponentStagedCounts[p.seat] ?? 0}
                  isActive={false}
                  className="pointer-events-auto"
                />
              </div>
            );
          })}

        <div
          className="pointer-events-none col-start-2 row-start-2 flex min-h-0 items-stretch justify-center"
          data-testid="charleston-discard-zone-region"
          data-board-region="discard-zone-region"
        >
          <div
            className="h-full w-full rounded-[3rem] border-4 border-black/75 bg-transparent"
            aria-hidden="true"
          />
        </div>

        <div
          className="pointer-events-auto col-span-3 row-start-3 self-end"
          data-testid="player-zone-region"
        >
          <PlayerZone
            staging={
              <StagingStrip
                incomingTiles={stagedIncomingTiles}
                outgoingTiles={outgoingTiles}
                slotCount={isBlindPassStage ? 6 : 3}
                blindIncoming={isBlindPassStage}
                canRevealBlind={selectedHandTiles.length >= 1}
                incomingFromSeat={isEnabled() ? storeIncomingFromSeat : null}
                onAbsorbIncoming={(tileId) => {
                  const tile = stagedIncomingTiles.find((entry) => entry.id === tileId);
                  if (!tile || (tile.hidden && selectedHandTiles.length < 1)) {
                    return;
                  }
                  // Keeping a blind tile removes it from the outgoing blind bundle, but the
                  // rack stays server-authoritative until the server later confirms the pass.
                  dispatch({ type: 'ABSORB_STAGED_TILE', tileIndex: tile.tileIndex });
                }}
                onRemoveOutgoing={(tileId) => toggleTile(tileId)}
                onCommitPass={handleCommitPass}
                onCommitCall={() => {}}
                onCommitDiscard={() => {}}
                canCommitPass={canCommitPass}
                canCommitCall={false}
                canCommitDiscard={false}
                isProcessing={passSubmissionInFlight}
                showActionButtons={false}
              />
            }
            rack={
              <PlayerRack
                tiles={handTileInstances}
                mode="charleston"
                selectedTileIds={selectedIds}
                onTileSelect={toggleTile}
                maxSelection={handMaxSelection}
                showSelectionCounter={false}
                disabled={isPassUiLocked || storeHasSubmittedVote || isCourtesyWaiting}
                disabledTileIds={handTileInstances
                  .filter((instance) => instance.tile === TILE_INDICES.JOKER)
                  .map((t) => t.id)}
                highlightedTileIds={isEnabled() ? storeHighlightedTileIds : []}
                newlyReceivedTileIds={storeNewlyReceivedTileIds}
                onNewlyReceivedTilesAcknowledged={() =>
                  dispatch({ type: 'CLEAR_NEWLY_RECEIVED_TILES' })
                }
                incomingFromSeat={isEnabled() ? storeIncomingFromSeat : null}
                leavingTileIds={isEnabled() ? storeLeavingTileIds : []}
                isActive={false}
              />
            }
            actions={
              <ActionBar
                phase={{ Charleston: stage }}
                mySeat={gameState.your_seat}
                selectedTiles={selectedIdsToTiles(selectedIds)}
                isProcessing={passSubmissionInFlight}
                hasSubmittedPass={isCourtesyStage ? isCourtesyWaiting : isPassUiLocked}
                hasSubmittedVote={storeHasSubmittedVote}
                disabled={false}
                readOnly={isHistoricalView}
                blindPassCount={stagedIncomingTiles.length}
                selectionSummary={{
                  selectedCount: selectedIds.length,
                  maxSelection: handMaxSelection,
                  blindPassCount: isBlindPassStage ? stagedIncomingTiles.length : 0,
                }}
                canCommitCharlestonPass={isVotingStage ? canSubmitVote : canCommitPass}
                canDeclareMahjong={canDeclareMahjong}
                onDeclareMahjong={mahjong.handleDeclareMahjong}
                onCommand={(cmd) => {
                  if ('CommitCharlestonPass' in cmd) {
                    handleCommitPass();
                    return;
                  }
                  if ('VoteCharleston' in cmd) {
                    handleVote(cmd.VoteCharleston.vote);
                    return;
                  }
                  sendCommand(cmd);
                }}
                courtesyPassCount={isSelectingTiles ? agreedCount : undefined}
                onCourtesyPassSubmit={isCourtesyStage ? handleCourtesyProceed : undefined}
              />
            }
          />
        </div>
        </div>
      </div>

      {/* Charleston Tracker */}
      {(() => {
        const tracker = (
          <CharlestonTracker
            stage={stage}
            readyPlayers={storeReadyPlayers}
            waitingMessage={votingWaitingMessage ?? undefined}
            timer={
              storeCharlestonTimer && charlestonSecondsRemaining !== null
                ? {
                    remainingSeconds: charlestonSecondsRemaining,
                    durationSeconds: storeCharlestonTimer.durationSeconds,
                    mode: storeCharlestonTimer.mode,
                  }
                : null
            }
            statusMessage={votingStatusMessage ?? undefined}
          />
        );

        return topChromeSlot ? createPortal(tracker, topChromeSlot) : tracker;
      })()}

      {/* Error Message */}
      {storeErrorMessage && (
        <div
          className={`absolute left-1/2 top-32 ${BOARD_LAYERS.chrome} -translate-x-1/2 rounded bg-red-900/80 px-4 py-2 text-sm text-red-100`}
          role="alert"
          data-testid="charleston-error-message"
        >
          {storeErrorMessage}
        </div>
      )}

      {/* Vote Result Overlay */}
      {storeShowVoteResultOverlay && storeVoteResult && (
        <VoteResultOverlay
          result={storeVoteResult}
          votes={storeVoteBreakdown || undefined}
          onDismiss={() => dispatch({ type: 'SET_SHOW_VOTE_RESULT_OVERLAY', value: false })}
          myVote={storeMyVote || undefined}
        />
      )}

      {/* Pass Animation Layer */}
      {storePassDirection && isEnabled() && <PassAnimationLayer direction={storePassDirection} />}

      {/* IOU Overlay */}
      {storeIouState?.active && (
        <IOUOverlay
          debts={storeIouState.debts}
          resolved={storeIouState.resolved}
          summary={storeIouState.summary}
        />
      )}

      <MahjongConfirmationDialog
        isOpen={mahjong.showMahjongDialog}
        hand={gameState.your_hand}
        mySeat={gameState.your_seat}
        isLoading={mahjong.mahjongDialogLoading}
        onConfirm={mahjong.handleMahjongConfirm}
        onCancel={mahjong.handleMahjongCancel}
      />
    </>
  );
}
