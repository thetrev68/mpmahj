import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { UIStateAction } from '@/lib/game-events/types';
import type { Seat } from '@/types/bindings/generated/Seat';
import { useAutoDraw } from '@/hooks/useAutoDraw';
import { useCallWindowState } from '@/hooks/useCallWindowState';
import { useGameAnimations } from '@/hooks/useGameAnimations';
import { useHintSystem } from '@/hooks/useHintSystem';
import { useHistoryPlayback } from '@/hooks/useHistoryPlayback';
import { useMahjongDeclaration } from '@/hooks/useMahjongDeclaration';
import { useMeldActions } from '@/hooks/useMeldActions';
import { usePlayingPhaseState } from '@/hooks/usePlayingPhaseState';

interface EventBus {
  on: (event: string, handler: (data: unknown) => void) => () => void;
}

export interface UsePlayingPhaseEventHandlersOptions {
  animations: ReturnType<typeof useGameAnimations>;
  autoDraw: ReturnType<typeof useAutoDraw>;
  callWindow: ReturnType<typeof useCallWindowState>;
  clearSelection: () => void;
  eventBus?: EventBus;
  gameSeat: Seat;
  historyPlayback: ReturnType<typeof useHistoryPlayback>;
  hintSystem: ReturnType<typeof useHintSystem>;
  incomingAnimationDurationRef: MutableRefObject<number>;
  mahjong: ReturnType<typeof useMahjongDeclaration>;
  meldActions: ReturnType<typeof useMeldActions>;
  playing: ReturnType<typeof usePlayingPhaseState>;
  setErrorMessage: Dispatch<SetStateAction<string | null>>;
  setForfeitedPlayers: Dispatch<SetStateAction<Set<Seat>>>;
  tileMovementEnabledRef: MutableRefObject<boolean>;
  turnKey: Seat;
}

export function usePlayingPhaseEventHandlers({
  animations,
  autoDraw,
  callWindow,
  clearSelection,
  eventBus,
  gameSeat,
  historyPlayback,
  hintSystem,
  incomingAnimationDurationRef,
  mahjong,
  meldActions,
  playing,
  setErrorMessage,
  setForfeitedPlayers,
  tileMovementEnabledRef,
  turnKey,
}: UsePlayingPhaseEventHandlersOptions): void {
  useEffect(() => {
    if (!eventBus) return;

    const unsub = eventBus.on('ui-action', (data: unknown) => {
      const action = data as UIStateAction;
      switch (action.type) {
        case 'OPEN_CALL_WINDOW':
          if (!mahjong.isDeadHand(gameSeat)) {
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
          if (tileMovementEnabledRef.current) {
            animations.setIncomingFromSeat(action.seat, incomingAnimationDurationRef.current);
          } else {
            animations.setIncomingFromSeat(null);
          }
          break;
        case 'SET_HIGHLIGHTED_TILE_IDS':
          if (tileMovementEnabledRef.current) {
            animations.setHighlightedTileIds(action.ids);
          } else {
            animations.setHighlightedTileIds([]);
          }
          break;
        case 'SET_LEAVING_TILE_IDS':
          if (tileMovementEnabledRef.current) {
            animations.setLeavingTileIds(action.ids);
          } else {
            animations.setLeavingTileIds([]);
          }
          break;
        case 'CLEAR_SELECTION':
          clearSelection();
          break;
        case 'SET_ERROR_MESSAGE':
          setErrorMessage(action.message);
          meldActions.handleUiAction(action);
          historyPlayback.clearPendingUndoOnError(action.message);
          break;
        case 'CLEAR_PENDING_DRAW_RETRY':
          autoDraw.clearPendingDrawRetry();
          break;
        case 'SET_PLAYER_FORFEITED':
          setForfeitedPlayers((prev) => new Set([...prev, action.player]));
          mahjong.handleUiAction(action);
          break;
        default:
          if (mahjong.handleUiAction(action)) break;
          if (meldActions.handleUiAction(action)) break;
          break;
      }
    });

    return unsub;
  }, [
    animations,
    autoDraw,
    callWindow,
    clearSelection,
    eventBus,
    gameSeat,
    historyPlayback,
    mahjong,
    meldActions,
    playing,
    setErrorMessage,
    setForfeitedPlayers,
    tileMovementEnabledRef,
    incomingAnimationDurationRef,
  ]);

  useEffect(() => {
    if (!eventBus) return;

    const unsubscribe = eventBus.on('server-event', (data: unknown) => {
      if (hintSystem.handleServerEvent(data)) return;
      historyPlayback.handleServerEvent(data);
    });

    return unsubscribe;
  }, [eventBus, hintSystem, historyPlayback]);

  useEffect(() => {
    playing.reset();
    animations.clearAllAnimations();
    clearSelection();
    hintSystem.resetForTurnChange();
    autoDraw.resetDrawRetry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnKey]);
}
