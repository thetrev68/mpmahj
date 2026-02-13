/**
 * CharlestonPhase Component
 *
 * Self-contained orchestrator for the Charleston tile-passing phase.
 * Extracted from GameBoard.tsx as part of Phase 2 refactoring.
 *
 * Related: GAMEBOARD_REFACTORING_PLAN.md Phase 2, US-005 (Charleston Voting)
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { CharlestonTracker } from '../CharlestonTracker';
import { BlindPassPanel } from '../BlindPassPanel';
import { ConcealedHand } from '../ConcealedHand';
import { ActionBar } from '../ActionBar';
import { VotingPanel } from '../VotingPanel';
import { VoteResultOverlay } from '../VoteResultOverlay';
import { PassAnimationLayer } from '../PassAnimationLayer';
import { IOUOverlay } from '../IOUOverlay';
import { CourtesyPassPanel } from '../CourtesyPassPanel';
import { CourtesyNegotiationStatus } from '../CourtesyNegotiationStatus';
import { useCharlestonState } from '@/hooks/useCharlestonState';
import { useGameAnimations } from '@/hooks/useGameAnimations';
import { useAnimationSettings } from '@/hooks/useAnimationSettings';
import { useTileSelection } from '@/hooks/useTileSelection';
import { TILE_INDICES } from '@/lib/utils/tileUtils';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { CharlestonStage } from '@/types/bindings/generated/CharlestonStage';
import type { CharlestonVote } from '@/types/bindings/generated/CharlestonVote';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { Tile } from '@/types/bindings/generated/Tile';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { UIStateAction } from '@/lib/game-events/types';

export interface CharlestonPhaseProps {
  gameState: GameStateSnapshot;
  stage: CharlestonStage;
  sendCommand: (cmd: GameCommand) => void;
  onLeaveConfirmed?: () => void;
  eventBus?: {
    on: (event: string, handler: (data: unknown) => void) => () => void;
  };
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
export function CharlestonPhase({
  gameState,
  stage,
  sendCommand,
  onLeaveConfirmed,
  eventBus,
}: CharlestonPhaseProps) {
  const charleston = useCharlestonState();
  const animations = useGameAnimations();
  const { getDuration, isEnabled } = useAnimationSettings();
  const tileMovementEnabledRef = useRef(isEnabled('tile_movement'));
  const charlestonPassEnabledRef = useRef(isEnabled('charleston_pass'));
  const passDirectionDurationRef = useRef(getDuration(600));
  const incomingDurationRef = useRef(getDuration(1500));
  const highlightDurationRef = useRef(getDuration(2000));
  const leavingDurationRef = useRef(getDuration(600));

  // IOU overlay state
  const [iouState, setIouState] = useState<{
    active: boolean;
    debts: Array<[Seat, number]>;
    resolved: boolean;
    summary?: string;
  } | null>(null);

  // Courtesy pass state (US-007)
  const [courtesyState, setCourtesyState] = useState<{
    isPending: boolean; // Waiting for partner's proposal
    myProposal?: number; // My proposed count (0-3)
    partnerProposal?: number; // Partner's proposed count (0-3)
    agreedCount?: number; // Agreed count after negotiation
    negotiationType?: 'agreement' | 'mismatch' | 'zero'; // Result type
    isSelectingTiles: boolean; // Whether currently selecting tiles to pass
  }>({
    isPending: false,
    isSelectingTiles: false,
  });

  // Refs for buffering vote result/breakdown (they arrive as separate actions)
  const pendingVoteResultRef = useRef<CharlestonVote | null>(null);
  const pendingVoteBreakdownRef = useRef<Record<Seat, CharlestonVote> | null>(null);

  // Vote retry state
  const pendingVoteRef = useRef<CharlestonVote | null>(null);
  const voteRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    tileMovementEnabledRef.current = isEnabled('tile_movement');
    charlestonPassEnabledRef.current = isEnabled('charleston_pass');
    passDirectionDurationRef.current = getDuration(600);
    incomingDurationRef.current = getDuration(1500);
    highlightDurationRef.current = getDuration(2000);
    leavingDurationRef.current = getDuration(600);
  }, [getDuration, isEnabled]);

  // Determine if this is a blind pass stage (FirstLeft, SecondLeft, SecondRight all allow blind passes)
  const isBlindPassStage =
    stage === 'FirstLeft' || stage === 'SecondLeft' || stage === 'SecondRight';
  const isVotingStage = stage === 'VotingToContinue';
  // CourtesyAcross is the entry point for US-007; hand is view-only and no PassTiles here
  const isCourtesyStage = stage === 'CourtesyAcross';

  // Tile selection configuration
  const handMaxSelection =
    isCourtesyStage && courtesyState.isSelectingTiles
      ? (courtesyState.agreedCount ?? 0)
      : isBlindPassStage
        ? 3 - charleston.blindPassCount
        : 3;

  const { selectedIds, toggleTile, clearSelection } = useTileSelection({
    maxSelection: handMaxSelection,
    disabledIds: gameState.your_hand
      .map((tile, idx) => ({ id: `${tile}-${idx}`, tile }))
      .filter((t) => t.tile === TILE_INDICES.JOKER)
      .map((t) => t.id),
  });

  // Subscribe to event bus UI actions
  useEffect(() => {
    if (!eventBus) return;

    const unsub = eventBus.on('ui-action', (data: unknown) => {
      const action = data as UIStateAction;
      switch (action.type) {
        case 'RESET_CHARLESTON_STATE':
          charleston.reset();
          animations.clearAllAnimations();
          clearSelection();
          break;
        case 'ADD_READY_PLAYER':
          charleston.markPlayerReady(action.seat);
          break;
        case 'SET_BOT_PASS_MESSAGE':
          charleston.setBotPassMessage(action.message);
          break;
        case 'SET_CHARLESTON_TIMER':
          charleston.setTimer(action.timer);
          break;
        case 'SET_PASS_DIRECTION':
          if (charlestonPassEnabledRef.current) {
            animations.setPassDirection(action.direction, passDirectionDurationRef.current);
          } else {
            animations.setPassDirection(null);
          }
          break;
        case 'SET_INCOMING_FROM_SEAT':
          if (tileMovementEnabledRef.current) {
            animations.setIncomingFromSeat(action.seat, incomingDurationRef.current);
          } else {
            animations.setIncomingFromSeat(null);
          }
          break;
        case 'SET_HIGHLIGHTED_TILE_IDS':
          if (tileMovementEnabledRef.current) {
            animations.setHighlightedTileIds(action.ids, highlightDurationRef.current);
          } else {
            animations.setHighlightedTileIds([]);
          }
          break;
        case 'SET_LEAVING_TILE_IDS':
          if (tileMovementEnabledRef.current) {
            animations.setLeavingTileIds(action.ids, leavingDurationRef.current);
          } else {
            animations.setLeavingTileIds([]);
          }
          break;
        case 'ADD_VOTED_PLAYER':
          charleston.markPlayerVoted(action.seat);
          break;
        case 'SET_BOT_VOTE_MESSAGE':
          charleston.setBotVoteMessage(action.message);
          break;
        case 'SET_VOTE_RESULT':
          pendingVoteResultRef.current = action.result;
          break;
        case 'SET_VOTE_BREAKDOWN':
          pendingVoteBreakdownRef.current = action.breakdown;
          break;
        case 'SET_SHOW_VOTE_RESULT_OVERLAY':
          if (
            action.value &&
            pendingVoteResultRef.current !== null &&
            pendingVoteBreakdownRef.current !== null
          ) {
            charleston.setVoteResult(pendingVoteResultRef.current, pendingVoteBreakdownRef.current);
            pendingVoteResultRef.current = null;
            pendingVoteBreakdownRef.current = null;
          }
          break;
        case 'SET_BLIND_PASS_COUNT':
          charleston.setBlindPassCount(action.count);
          break;
        case 'SET_ERROR_MESSAGE':
          charleston.setErrorMessage(action.message);
          break;
        case 'CLEAR_SELECTION':
          clearSelection();
          break;
        case 'CLEAR_PENDING_VOTE_RETRY':
          if (voteRetryTimerRef.current !== null) {
            clearTimeout(voteRetryTimerRef.current);
            voteRetryTimerRef.current = null;
          }
          pendingVoteRef.current = null;
          break;
        case 'SET_IOU_STATE':
          setIouState(action.state);
          break;
        case 'RESOLVE_IOU':
          setIouState((prev) =>
            prev ? { ...prev, resolved: true, summary: action.summary } : prev
          );
          break;
        case 'CLEAR_IOU':
          setIouState(null);
          break;
        // US-007: Courtesy pass negotiation
        case 'SET_COURTESY_PARTNER_PROPOSAL':
          setCourtesyState((prev) => ({ ...prev, partnerProposal: action.count }));
          break;
        case 'SET_COURTESY_AGREEMENT':
          setCourtesyState((prev) => ({
            ...prev,
            isPending: false,
            agreedCount: action.count,
            negotiationType: 'agreement',
            isSelectingTiles: action.count > 0,
          }));
          break;
        case 'SET_COURTESY_MISMATCH':
          setCourtesyState((prev) => ({
            ...prev,
            isPending: false,
            partnerProposal: action.partnerProposal,
            agreedCount: action.agreedCount,
            negotiationType: 'mismatch',
            isSelectingTiles: action.agreedCount > 0,
          }));
          break;
        case 'SET_COURTESY_ZERO':
          setCourtesyState((prev) => ({
            ...prev,
            isPending: false,
            agreedCount: 0,
            negotiationType: 'zero',
            isSelectingTiles: false,
          }));
          break;
        case 'RESET_COURTESY_STATE':
          setCourtesyState({
            isPending: false,
            isSelectingTiles: false,
          });
          break;
        default:
          break;
      }
    });

    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventBus]);

  // Reset state on stage change
  useEffect(() => {
    charleston.reset();
    animations.clearAllAnimations();
    clearSelection();
    setCourtesyState({
      isPending: false,
      isSelectingTiles: false,
    });
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

  // Handle vote command (with retry on missing ack)
  const handleVote = useCallback(
    (vote: CharlestonVote) => {
      sendCommand({
        VoteCharleston: { player: gameState.your_seat, vote },
      });
      charleston.submitVote(vote);
      pendingVoteRef.current = vote;

      // Start retry timer: if no PlayerVoted ack within 5s, retry
      if (voteRetryTimerRef.current !== null) clearTimeout(voteRetryTimerRef.current);
      voteRetryTimerRef.current = setTimeout(() => {
        if (pendingVoteRef.current === null) return;
        charleston.setErrorMessage('Failed to submit vote. Retrying...');
        sendCommand({
          VoteCharleston: { player: gameState.your_seat, vote: pendingVoteRef.current },
        });
        voteRetryTimerRef.current = null;
      }, 5000);
    },
    [sendCommand, gameState.your_seat, charleston]
  );

  // Get across partner seat (US-007)
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

  // Handle courtesy pass proposal (US-007, AC-2)
  const handleCourtesyProposal = useCallback(
    (count: number) => {
      sendCommand({
        ProposeCourtesyPass: { player: gameState.your_seat, tile_count: count },
      });
      setCourtesyState((prev) => ({
        ...prev,
        isPending: true,
        myProposal: count,
      }));
    },
    [sendCommand, gameState.your_seat]
  );

  // Handle courtesy pass tile submission (US-007, AC-7)
  const handleCourtesyTileSubmission = useCallback(() => {
    const tiles = selectedIds
      .map((id) => parseInt(id.split('-')[0]))
      .filter((t): t is Tile => !isNaN(t));

    if (tiles.length !== courtesyState.agreedCount) {
      charleston.setErrorMessage(`Must select exactly ${courtesyState.agreedCount} tiles`);
      return;
    }

    sendCommand({
      AcceptCourtesyPass: { player: gameState.your_seat, tiles },
    });

    setCourtesyState((prev) => ({ ...prev, isSelectingTiles: false }));
    clearSelection();
  }, [
    selectedIds,
    courtesyState.agreedCount,
    sendCommand,
    gameState.your_seat,
    charleston,
    clearSelection,
  ]);

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
          data-testid="charleston-error-message"
        >
          {charleston.messages.error}
        </div>
      )}

      {/* Courtesy Pass Panel (US-007) */}
      {isCourtesyStage && !courtesyState.negotiationType && (
        <div className="fixed top-[180px] left-1/2 -translate-x-1/2 z-20 w-[400px]">
          <CourtesyPassPanel
            onPropose={handleCourtesyProposal}
            acrossPartnerSeat={acrossPartnerSeat}
            isPending={courtesyState.isPending}
            proposedCount={courtesyState.myProposal}
          />
        </div>
      )}

      {/* Courtesy Negotiation Status (US-007) */}
      {isCourtesyStage &&
        courtesyState.negotiationType &&
        courtesyState.agreedCount !== undefined && (
          <div className="fixed top-[180px] left-1/2 -translate-x-1/2 z-20 w-[450px]">
            <CourtesyNegotiationStatus
              type={courtesyState.negotiationType}
              agreedCount={courtesyState.agreedCount}
              acrossPartnerSeat={acrossPartnerSeat}
              myProposal={courtesyState.myProposal}
              partnerProposal={courtesyState.partnerProposal}
            />
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

      {/* Concealed Hand (always visible; view-only during voting) */}
      <ConcealedHand
        tiles={gameState.your_hand.map((tile, idx) => ({
          id: `${tile}-${idx}`,
          tile,
        }))}
        mode={
          isVotingStage || (isCourtesyStage && !courtesyState.isSelectingTiles)
            ? 'view-only'
            : 'charleston'
        }
        selectedTileIds={
          isVotingStage || (isCourtesyStage && !courtesyState.isSelectingTiles) ? [] : selectedIds
        }
        onTileSelect={
          isVotingStage || (isCourtesyStage && !courtesyState.isSelectingTiles)
            ? () => {}
            : toggleTile
        }
        maxSelection={
          isVotingStage || (isCourtesyStage && !courtesyState.isSelectingTiles)
            ? 0
            : handMaxSelection
        }
        disabled={
          charleston.hasSubmittedPass ||
          isVotingStage ||
          (isCourtesyStage && !courtesyState.isSelectingTiles)
        }
        disabledTileIds={gameState.your_hand
          .map((tile, idx) => ({ id: `${tile}-${idx}`, tile }))
          .filter((t) => t.tile === TILE_INDICES.JOKER)
          .map((t) => t.id)}
        highlightedTileIds={isEnabled('tile_movement') ? animations.highlightedTileIds : []}
        incomingFromSeat={isEnabled('tile_movement') ? animations.incomingFromSeat : null}
        leavingTileIds={isEnabled('tile_movement') ? animations.leavingTileIds : []}
        blindPassCount={isBlindPassStage ? charleston.blindPassCount : undefined}
      />

      {/* Action Bar — not shown during Courtesy proposal phase, shown during tile selection */}
      {!isCourtesyStage || courtesyState.isSelectingTiles ? (
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
          onLeaveConfirmed={onLeaveConfirmed}
          courtesyPassCount={courtesyState.isSelectingTiles ? courtesyState.agreedCount : undefined}
          onCourtesyPassSubmit={
            courtesyState.isSelectingTiles ? handleCourtesyTileSubmission : undefined
          }
        />
      ) : null}

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
      {/* TODO(US-007): Add courtesy pass tile exchange animations (deferred - server-timed) */}
      {animations.passDirection && isEnabled('charleston_pass') && (
        <PassAnimationLayer direction={animations.passDirection} />
      )}

      {/* IOU Overlay */}
      {iouState?.active && (
        <IOUOverlay
          debts={iouState.debts}
          resolved={iouState.resolved}
          summary={iouState.summary}
        />
      )}
    </>
  );
}
