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
import { CharlestonTracker } from '../CharlestonTracker';
import { PlayerRack } from '../PlayerRack';
import { ActionBar } from '../ActionBar';
import { VoteResultOverlay } from '../VoteResultOverlay';
import { PassAnimationLayer } from '../PassAnimationLayer';
import { IOUOverlay } from '../IOUOverlay';
import { CourtesyPassPanel } from '../CourtesyPassPanel';
import { CourtesyNegotiationStatus } from '../CourtesyNegotiationStatus';
import { OpponentRack } from '../OpponentRack';
import { PlayerZone } from '../PlayerZone';
import { StagingStrip, type StagedTile } from '../StagingStrip';
import { getOpponentPosition } from '../opponentRackUtils';
import { useGameUIStore } from '@/stores/gameUIStore';
import { useAnimationSettings } from '@/hooks/useAnimationSettings';
import { useCountdown } from '@/hooks/useCountdown';
import { useTileSelection } from '@/hooks/useTileSelection';
import { CHARLESTON_PASS_COUNT } from '@/lib/constants';
import { TILE_INDICES } from '@/lib/utils/tileUtils';
import { buildTileInstances, selectedIdsToTiles } from '@/lib/utils/tileSelection';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { CharlestonStage } from '@/types/bindings/generated/CharlestonStage';
import type { CharlestonVote } from '@/types/bindings/generated/CharlestonVote';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { Seat } from '@/types/bindings/generated/Seat';

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
}

/**
 * Charleston phase component.
 *
 * Reads all transient UI state from `useGameUIStore` (the single authority established in
 * Phase 4, slice 4.1). The old eventBus ui-action subscription has been fully removed.
 */
export function CharlestonPhase({ gameState, stage, sendCommand }: CharlestonPhaseProps) {
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

  // Courtesy pass (server-driven parts)
  const storeCourtesyPartnerProposal = useGameUIStore((s) => s.courtesyPartnerProposal);
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

  // Optimistic pass submission flag — set when user clicks, cleared on stage change or error.
  const [passSubmissionInFlight, setPassSubmissionInFlight] = useState(false);

  // Courtesy pass: purely local (user action) state.
  const [myProposal, setMyProposal] = useState<number | undefined>();
  const [isPending, setIsPending] = useState(false);

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

  const isSelectingTiles =
    negotiationType !== undefined && negotiationType !== 'zero' && agreedCount > 0;

  const partnerProposal: number | undefined =
    storeCourtesyMismatch?.partnerProposal ?? storeCourtesyPartnerProposal ?? undefined;

  // ── Stage / phase flags ───────────────────────────────────────────────────

  const isBlindPassStage = stage === 'FirstLeft' || stage === 'SecondRight';
  const isVotingStage = stage === 'VotingToContinue';
  const isCourtesyStage = stage === 'CourtesyAcross';
  const isPassUiLocked = storeHasSubmittedPass || passSubmissionInFlight;

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
        hidden:
          storeStagedIncoming.from === null &&
          !storeStagedIncoming.revealedTileIndexes.includes(tileIndex),
      }))
      .filter((tile) => !storeStagedIncoming.absorbedTileIndexes.includes(tile.tileIndex));
  }, [storeStagedIncoming]);

  const absorbedIncomingTileInstances = useMemo(
    () =>
      storeStagedIncoming?.context === 'Charleston'
        ? storeStagedIncoming.absorbedTileIndexes.map((tileIndex) => ({
            id: `${storeStagedIncoming.tiles[tileIndex]}-absorbed-${storeStagedIncoming.stage}-${tileIndex}`,
            tile: storeStagedIncoming.tiles[tileIndex],
          }))
        : [],
    [storeStagedIncoming]
  );

  const handTileInstances = useMemo(
    () => [...serverHandTileInstances, ...absorbedIncomingTileInstances],
    [absorbedIncomingTileInstances, serverHandTileInstances]
  );

  const handMaxSelection =
    isCourtesyStage && isSelectingTiles ? agreedCount : Math.max(0, 3 - stagedIncomingTiles.length);

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

  const handleCommitPass = useCallback(() => {
    if (!canCommitPass) {
      return;
    }

    setPassSubmissionInFlight(true);
    sendCommand({
      CommitCharlestonPass: {
        player: gameState.your_seat,
        from_hand: selectedIdsToTiles(selectedIds),
        forward_incoming_count: stagedIncomingTiles.length,
      },
    });
  }, [canCommitPass, gameState.your_seat, selectedIds, sendCommand, stagedIncomingTiles.length]);

  // ── Signal: CLEAR_SELECTION ───────────────────────────────────────────────

  useEffect(() => {
    if (clearSelectionSignal > 0) clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearSelectionSignal]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courtesyZeroSignal]);

  // ── Bridge: errorMessage → reset passSubmissionInFlight on retryable errors

  useEffect(() => {
    if (
      storeErrorMessage &&
      (/tile not in hand/i.test(storeErrorMessage) || /rate limit/i.test(storeErrorMessage))
    ) {
      setPassSubmissionInFlight(false);
    }
  }, [storeErrorMessage]);

  // ── Courtesy: clear isPending when server responds ────────────────────────

  useEffect(() => {
    if (storeCourtesyAgreement !== null || storeCourtesyMismatch !== null) {
      setIsPending(false);
    }
  }, [storeCourtesyAgreement, storeCourtesyMismatch]);

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
    setMyProposal(undefined);
    setIsPending(false);
    setPassSubmissionInFlight(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

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

  const getAcrossPartner = useCallback((seat: Seat): Seat => {
    const map: Record<Seat, Seat> = {
      East: 'West',
      South: 'North',
      West: 'East',
      North: 'South',
    };
    return map[seat];
  }, []);

  const acrossPartnerSeat = getAcrossPartner(gameState.your_seat);

  const canSubmitVote =
    isVotingStage &&
    !storeHasSubmittedVote &&
    (selectedIds.length === 0 || selectedIds.length === CHARLESTON_PASS_COUNT);

  const handleCourtesyProposal = useCallback(
    (count: number) => {
      sendCommand({
        ProposeCourtesyPass: { player: gameState.your_seat, tile_count: count },
      });
      setMyProposal(count);
      setIsPending(true);
    },
    [sendCommand, gameState.your_seat]
  );

  const handleCourtesyTileSubmission = useCallback(() => {
    const tiles = selectedIdsToTiles(selectedIds);

    if (tiles.length !== agreedCount) {
      dispatch({ type: 'SET_ERROR_MESSAGE', message: `Must select exactly ${agreedCount} tiles` });
      return;
    }

    sendCommand({
      AcceptCourtesyPass: { player: gameState.your_seat, tiles },
    });

    clearSelection();
  }, [selectedIds, agreedCount, sendCommand, gameState.your_seat, dispatch, clearSelection]);

  return (
    <>
      {/* Opponent racks — face-down tiles for each opponent */}
      {gameState.players
        .filter((p) => p.seat !== gameState.your_seat)
        .map((p) => {
          const pos = getOpponentPosition(gameState.your_seat, p.seat);
          const posClass =
            pos === 'top'
              ? 'absolute left-1/2 top-4 z-10 -translate-x-1/2'
              : pos === 'right'
                ? 'absolute right-0 top-[42%] z-10 -translate-y-1/2'
                : 'absolute left-0 top-[42%] z-10 -translate-y-1/2';
          return (
            <OpponentRack
              key={p.seat}
              player={p}
              yourSeat={gameState.your_seat}
              charlestonReadyCount={storeOpponentStagedCounts[p.seat] ?? 0}
              isActive={false}
              className={posClass}
            />
          );
        })}

      {/* Charleston Tracker */}
      <CharlestonTracker
        stage={stage}
        readyPlayers={storeReadyPlayers}
        timer={
          storeCharlestonTimer && charlestonSecondsRemaining !== null
            ? {
                remainingSeconds: charlestonSecondsRemaining,
                durationSeconds: storeCharlestonTimer.durationSeconds,
                mode: storeCharlestonTimer.mode,
              }
            : null
        }
        statusMessage={storeBotPassMessage || undefined}
      />

      {/* Error Message */}
      {storeErrorMessage && (
        <div
          className="absolute left-1/2 top-24 z-20 -translate-x-1/2 rounded bg-red-900/80 px-4 py-2 text-sm text-red-100"
          role="alert"
          data-testid="charleston-error-message"
        >
          {storeErrorMessage}
        </div>
      )}

      {/* Courtesy Pass Panel (US-007) */}
      {isCourtesyStage && !negotiationType && (
        <div className="absolute left-1/2 top-36 z-20 w-[min(400px,calc(100%-2rem))] -translate-x-1/2">
          <CourtesyPassPanel
            onPropose={handleCourtesyProposal}
            acrossPartnerSeat={acrossPartnerSeat}
            isPending={isPending}
            proposedCount={myProposal}
          />
        </div>
      )}

      {/* Courtesy Negotiation Status (US-007) */}
      {isCourtesyStage && negotiationType && agreedCount !== undefined && (
        <div className="absolute left-1/2 top-36 z-20 w-[min(450px,calc(100%-2rem))] -translate-x-1/2">
          <CourtesyNegotiationStatus
            type={negotiationType}
            agreedCount={agreedCount}
            acrossPartnerSeat={acrossPartnerSeat}
            myProposal={myProposal}
            partnerProposal={partnerProposal}
          />
        </div>
      )}

      <PlayerZone
        staging={
          <StagingStrip
            incomingTiles={stagedIncomingTiles}
            outgoingTiles={outgoingTiles}
            incomingSlotCount={3}
            outgoingSlotCount={3}
            blindIncoming={isBlindPassStage}
            incomingFromSeat={isEnabled() ? storeIncomingFromSeat : null}
            onFlipIncoming={(tileId) => {
              const tile = stagedIncomingTiles.find((entry) => entry.id === tileId);
              if (!tile) return;
              dispatch({ type: 'FLIP_STAGED_TILE', tileIndex: tile.tileIndex });
            }}
            onAbsorbIncoming={(tileId) => {
              const tile = stagedIncomingTiles.find((entry) => entry.id === tileId);
              if (!tile || tile.hidden) {
                return;
              }
              dispatch({ type: 'ABSORB_STAGED_TILE', tileIndex: tile.tileIndex });
              clearSelection();
            }}
            onRemoveOutgoing={(tileId) => toggleTile(tileId)}
            onCommitPass={handleCommitPass}
            onCommitCall={() => {}}
            onCommitDiscard={() => {}}
            canCommitPass={canCommitPass}
            canCommitCall={false}
            canCommitDiscard={false}
            isProcessing={passSubmissionInFlight}
          />
        }
        rack={
          <PlayerRack
            tiles={handTileInstances}
            mode={isCourtesyStage && !isSelectingTiles ? 'view-only' : 'charleston'}
            selectedTileIds={isCourtesyStage && !isSelectingTiles ? [] : selectedIds}
            onTileSelect={isCourtesyStage && !isSelectingTiles ? () => {} : toggleTile}
            maxSelection={isCourtesyStage && !isSelectingTiles ? 0 : handMaxSelection}
            disabled={
              isPassUiLocked || storeHasSubmittedVote || (isCourtesyStage && !isSelectingTiles)
            }
            disabledTileIds={handTileInstances
              .filter((instance) => instance.tile === TILE_INDICES.JOKER)
              .map((t) => t.id)}
            highlightedTileIds={isEnabled() ? storeHighlightedTileIds : []}
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
            hasSubmittedPass={isPassUiLocked}
            hasSubmittedVote={storeHasSubmittedVote}
            myVote={storeMyVote ?? undefined}
            votedPlayers={storeVotedPlayers}
            totalPlayers={4}
            botVoteMessage={storeBotVoteMessage || undefined}
            disabled={isCourtesyStage && !isSelectingTiles}
            blindPassCount={stagedIncomingTiles.length}
            canCommitCharlestonPass={isVotingStage ? canSubmitVote : canCommitPass}
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
            onCourtesyPassSubmit={isSelectingTiles ? handleCourtesyTileSubmission : undefined}
          />
        }
      />

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
    </>
  );
}
