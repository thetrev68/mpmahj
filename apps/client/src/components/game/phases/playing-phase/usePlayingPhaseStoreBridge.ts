import { useEffect, useRef } from 'react';
import { useGameUIStore } from '@/stores/gameUIStore';
import type { UIStateAction } from '@/lib/game-events/types';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { Tile } from '@/types/bindings/generated/Tile';
import type { StagedTile } from '@/components/game/StagingStrip';

interface MahjongUiActionBridge {
  handleUiAction: (action: UIStateAction) => void;
}

interface MeldUiActionBridge {
  handleUiAction: (action: UIStateAction) => void;
}

interface PlayingStateBridge {
  discardAnimationTile: Tile | null;
  stagedIncomingTile: StagedTile | null;
  setDiscardAnimation: (tile: Tile | null) => void;
  setStagedIncomingTile: (tile: StagedTile | null) => void;
}

interface AnimationsBridge {
  setIncomingFromSeat: (seat: Seat | null, autoHideMs?: number) => void;
  setHighlightedTileIds: (ids: string[]) => void;
  setLeavingTileIds: (ids: string[]) => void;
}

interface HistoryPlaybackBridge {
  clearPendingUndoOnError: (message: string | null) => void;
}

interface AutoDrawBridge {
  clearPendingDrawRetry: () => void;
}

interface UsePlayingPhaseStoreBridgeOptions {
  animations: AnimationsBridge;
  autoDraw: AutoDrawBridge;
  clearSelection: () => void;
  historyPlayback: HistoryPlaybackBridge;
  incomingAnimationDurationMs: number;
  isDiscardingStage: boolean;
  isTileMovementEnabled: boolean;
  mahjong: MahjongUiActionBridge;
  meldActions: MeldUiActionBridge;
  playing: PlayingStateBridge;
}

function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

function useSignalEffect(signal: number, handler: () => void): void {
  const handlerRef = useLatestRef(handler);
  const previousSignalRef = useRef(signal);

  useEffect(() => {
    if (signal < previousSignalRef.current) {
      previousSignalRef.current = signal;
      return;
    }
    if (signal === previousSignalRef.current) return;
    previousSignalRef.current = signal;
    handlerRef.current();
  }, [signal, handlerRef]);
}

export function usePlayingPhaseStoreBridge({
  animations,
  autoDraw,
  clearSelection,
  historyPlayback,
  incomingAnimationDurationMs,
  isDiscardingStage,
  isTileMovementEnabled,
  mahjong,
  meldActions,
  playing,
}: UsePlayingPhaseStoreBridgeOptions): void {
  const clearSelectionSignal = useGameUIStore((s) => s.clearSelectionSignal);
  const clearPendingDrawRetrySignal = useGameUIStore((s) => s.clearPendingDrawRetrySignal);
  const storeIncomingFromSeat = useGameUIStore((s) => s.incomingFromSeat);
  const storeHighlightedTileIds = useGameUIStore((s) => s.highlightedTileIds);
  const storeLeavingTileIds = useGameUIStore((s) => s.leavingTileIds);
  const errorMessage = useGameUIStore((s) => s.errorMessage);
  const storeMahjongDeclaredPlayer = useGameUIStore((s) => s.mahjongDeclaredPlayer);
  const storeAwaitingMahjongValidation = useGameUIStore((s) => s.awaitingMahjongValidation);
  const storeMahjongValidatedResult = useGameUIStore((s) => s.mahjongValidatedResult);
  const storeDeadHandPlayers = useGameUIStore((s) => s.deadHandPlayers);
  const storeSkippedPlayers = useGameUIStore((s) => s.skippedPlayers);
  const storeJokerExchanged = useGameUIStore((s) => s.jokerExchanged);
  const storeMeldUpgraded = useGameUIStore((s) => s.meldUpgraded);

  const mahjongRef = useLatestRef(mahjong);
  const meldActionsRef = useLatestRef(meldActions);
  const clearSelectionRef = useLatestRef(clearSelection);
  const autoDrawRef = useLatestRef(autoDraw);
  const historyPlaybackRef = useLatestRef(historyPlayback);
  const animationsRef = useLatestRef(animations);
  const playingRef = useLatestRef(playing);
  const incomingAnimationDurationRef = useLatestRef(incomingAnimationDurationMs);

  useSignalEffect(clearSelectionSignal, () => clearSelectionRef.current());
  useSignalEffect(clearPendingDrawRetrySignal, () => autoDrawRef.current.clearPendingDrawRetry());

  useEffect(() => {
    const nextIncoming = isTileMovementEnabled ? storeIncomingFromSeat : null;
    const duration = isTileMovementEnabled ? incomingAnimationDurationRef.current : undefined;
    animationsRef.current.setIncomingFromSeat(nextIncoming, duration);
  }, [storeIncomingFromSeat, isTileMovementEnabled, animationsRef, incomingAnimationDurationRef]);

  useEffect(() => {
    animationsRef.current.setHighlightedTileIds(
      isTileMovementEnabled ? storeHighlightedTileIds : []
    );
  }, [storeHighlightedTileIds, isTileMovementEnabled, animationsRef]);

  useEffect(() => {
    animationsRef.current.setLeavingTileIds(isTileMovementEnabled ? storeLeavingTileIds : []);
  }, [storeLeavingTileIds, isTileMovementEnabled, animationsRef]);

  useEffect(() => {
    if (errorMessage !== null) {
      meldActionsRef.current.handleUiAction({
        type: 'SET_ERROR_MESSAGE',
        message: errorMessage,
      });
    }
    historyPlaybackRef.current.clearPendingUndoOnError(errorMessage);
  }, [errorMessage, meldActionsRef, historyPlaybackRef]);

  useEffect(() => {
    if (!storeMahjongDeclaredPlayer) return;
    mahjongRef.current.handleUiAction({
      type: 'SET_MAHJONG_DECLARED',
      player: storeMahjongDeclaredPlayer,
    });
  }, [storeMahjongDeclaredPlayer, mahjongRef]);

  useEffect(() => {
    if (!storeAwaitingMahjongValidation) return;
    mahjongRef.current.handleUiAction({
      type: 'SET_AWAITING_MAHJONG_VALIDATION',
      caller: storeAwaitingMahjongValidation.caller,
      calledTile: storeAwaitingMahjongValidation.calledTile,
      discardedBy: storeAwaitingMahjongValidation.discardedBy,
    });
  }, [storeAwaitingMahjongValidation, mahjongRef]);

  useEffect(() => {
    if (!storeMahjongValidatedResult) return;
    mahjongRef.current.handleUiAction({
      type: 'SET_MAHJONG_VALIDATED',
      player: storeMahjongValidatedResult.player,
      valid: storeMahjongValidatedResult.valid,
      pattern: storeMahjongValidatedResult.pattern,
    });
  }, [storeMahjongValidatedResult, mahjongRef]);

  const processedDeadHandCountRef = useRef(0);
  useEffect(() => {
    const newEntries = storeDeadHandPlayers.slice(processedDeadHandCountRef.current);
    processedDeadHandCountRef.current = storeDeadHandPlayers.length;
    for (const entry of newEntries) {
      mahjongRef.current.handleUiAction({
        type: 'SET_HAND_DECLARED_DEAD',
        player: entry.player,
        reason: entry.reason,
      });
    }
  }, [storeDeadHandPlayers, mahjongRef]);

  const processedSkippedCountRef = useRef(0);
  useEffect(() => {
    const newEntries = storeSkippedPlayers.slice(processedSkippedCountRef.current);
    processedSkippedCountRef.current = storeSkippedPlayers.length;
    for (const entry of newEntries) {
      mahjongRef.current.handleUiAction({
        type: 'SET_PLAYER_SKIPPED',
        player: entry.player,
        reason: entry.reason,
      });
    }
  }, [storeSkippedPlayers, mahjongRef]);

  useEffect(() => {
    if (!storeJokerExchanged) return;
    meldActionsRef.current.handleUiAction({
      type: 'SET_JOKER_EXCHANGED',
      player: storeJokerExchanged.player,
      target_seat: storeJokerExchanged.target_seat,
      joker: storeJokerExchanged.joker,
      replacement: storeJokerExchanged.replacement,
    });
  }, [storeJokerExchanged, meldActionsRef]);

  useEffect(() => {
    if (!storeMeldUpgraded) return;
    meldActionsRef.current.handleUiAction({
      type: 'SET_MELD_UPGRADED',
      player: storeMeldUpgraded.player,
      meld_index: storeMeldUpgraded.meld_index,
      new_meld_type: storeMeldUpgraded.new_meld_type,
    });
  }, [storeMeldUpgraded, meldActionsRef]);

  useEffect(() => {
    if (playing.discardAnimationTile !== null && !isTileMovementEnabled) {
      playingRef.current.setDiscardAnimation(null);
    }
  }, [isTileMovementEnabled, playing.discardAnimationTile, playingRef]);

  useEffect(() => {
    if (!isDiscardingStage) {
      clearSelectionRef.current();
      playingRef.current.setStagedIncomingTile(null);
    }
  }, [isDiscardingStage, clearSelectionRef, playingRef]);

  useEffect(() => {
    if (!playing.stagedIncomingTile) return;
    const id = setTimeout(
      () => playingRef.current.setStagedIncomingTile(null),
      incomingAnimationDurationRef.current
    );
    return () => clearTimeout(id);
  }, [playing.stagedIncomingTile, playingRef, incomingAnimationDurationRef]);
}
