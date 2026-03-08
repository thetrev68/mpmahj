import { useCallback, useRef, useState } from 'react';
import type { UIStateAction } from '@/lib/game-events/types';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { Tile } from '@/types/bindings/generated/Tile';

export interface UseMahjongDeclarationOptions {
  gameState: GameStateSnapshot;
  sendCommand: (command: GameCommand) => void;
  setPlayingProcessing: (processing: boolean) => void;
}

export interface UseMahjongDeclarationResult {
  showMahjongDialog: boolean;
  mahjongDialogLoading: boolean;
  mahjongDeclaredMessage: string | null;
  deadHandNotice: string | null;
  deadHandPlayers: Set<Seat>;
  showDeadHandOverlay: boolean;
  deadHandOverlayData: { player: Seat; reason: string } | null;
  awaitingMahjongValidation: { calledTile: Tile; discardedBy: Seat } | null;
  awaitingValidationLoading: boolean;
  handleDeclareMahjong: () => void;
  handleMahjongConfirm: (command: GameCommand) => void;
  handleMahjongCancel: () => void;
  handleMahjongValidationSubmit: (command: GameCommand) => void;
  setDeadHandOverlayVisible: (visible: boolean) => void;
  isDeadHand: (seat: Seat) => boolean;
  handleUiAction: (action: UIStateAction) => boolean;
}

type MahjongActionType =
  | 'SET_MAHJONG_DECLARED'
  | 'SET_AWAITING_MAHJONG_VALIDATION'
  | 'SET_MAHJONG_VALIDATED'
  | 'SET_HAND_DECLARED_DEAD'
  | 'SET_PLAYER_SKIPPED';

function getInitialDeadPlayers(gameState: GameStateSnapshot): Set<Seat> {
  return new Set(gameState.players.filter((player) => player.status === 'Dead').map((p) => p.seat));
}

export function useMahjongDeclaration({
  gameState,
  sendCommand,
  setPlayingProcessing,
}: UseMahjongDeclarationOptions): UseMahjongDeclarationResult {
  const [showMahjongDialog, setShowMahjongDialog] = useState(false);
  const [mahjongDialogLoading, setMahjongDialogLoading] = useState(false);
  const [mahjongDeclaredMessage, setMahjongDeclaredMessage] = useState<string | null>(null);
  const [deadHandNotice, setDeadHandNotice] = useState<string | null>(null);
  const [deadHandPlayers, setDeadHandPlayers] = useState<Set<Seat>>(() =>
    getInitialDeadPlayers(gameState)
  );
  const deadHandPlayersRef = useRef(deadHandPlayers);
  const [showDeadHandOverlay, setShowDeadHandOverlay] = useState(false);
  const [deadHandOverlayData, setDeadHandOverlayData] = useState<{
    player: Seat;
    reason: string;
  } | null>(null);
  const [awaitingMahjongValidation, setAwaitingMahjongValidation] = useState<{
    calledTile: Tile;
    discardedBy: Seat;
  } | null>(null);
  const [awaitingValidationLoading, setAwaitingValidationLoading] = useState(false);

  const handleDeclareMahjong = useCallback(() => {
    setShowMahjongDialog(true);
  }, []);

  const handleMahjongConfirm = useCallback(
    (command: GameCommand) => {
      setMahjongDialogLoading(true);
      setPlayingProcessing(true);
      sendCommand(command);
    },
    [sendCommand, setPlayingProcessing]
  );

  const handleMahjongCancel = useCallback(() => {
    setShowMahjongDialog(false);
    setMahjongDialogLoading(false);
  }, []);

  const handleMahjongValidationSubmit = useCallback(
    (command: GameCommand) => {
      setAwaitingValidationLoading(true);
      setPlayingProcessing(true);
      sendCommand(command);
    },
    [sendCommand, setPlayingProcessing]
  );

  const isDeadHand = useCallback((seat: Seat) => deadHandPlayersRef.current.has(seat), []);

  const handleUiAction = useCallback(
    (action: UIStateAction) => {
      const handlers: Record<MahjongActionType, (typedAction: UIStateAction) => boolean> = {
        SET_MAHJONG_DECLARED: (typedAction) => {
          if (typedAction.type !== 'SET_MAHJONG_DECLARED') return false;
          setMahjongDeclaredMessage(`${typedAction.player} is declaring Mahjong...`);
          return true;
        },
        SET_AWAITING_MAHJONG_VALIDATION: (typedAction) => {
          if (typedAction.type !== 'SET_AWAITING_MAHJONG_VALIDATION') return false;
          setAwaitingMahjongValidation({
            calledTile: typedAction.calledTile,
            discardedBy: typedAction.discardedBy,
          });
          return true;
        },
        SET_MAHJONG_VALIDATED: (typedAction) => {
          if (typedAction.type !== 'SET_MAHJONG_VALIDATED') return false;
          setMahjongDialogLoading(false);
          setAwaitingValidationLoading(false);
          setAwaitingMahjongValidation(null);
          setMahjongDeclaredMessage(null);
          if (!typedAction.valid) {
            setShowMahjongDialog(false);
            setPlayingProcessing(false);
            setDeadHandNotice('Invalid Mahjong - Hand does not match any pattern');
          }
          return true;
        },
        SET_HAND_DECLARED_DEAD: (typedAction) => {
          if (typedAction.type !== 'SET_HAND_DECLARED_DEAD') return false;
          const isLocalPlayer = typedAction.player === gameState.your_seat;
          setDeadHandNotice(
            isLocalPlayer
              ? 'You have a dead hand. You will be skipped for the rest of the game.'
              : `${typedAction.player}'s hand is declared dead: ${typedAction.reason}`
          );
          setDeadHandPlayers((prev) => {
            const next = new Set([...prev, typedAction.player]);
            deadHandPlayersRef.current = next;
            return next;
          });
          if (isLocalPlayer) {
            setDeadHandOverlayData({ player: typedAction.player, reason: typedAction.reason });
            setShowDeadHandOverlay(true);
          }
          return true;
        },
        SET_PLAYER_SKIPPED: (typedAction) => {
          if (typedAction.type !== 'SET_PLAYER_SKIPPED') return false;
          setDeadHandNotice(`${typedAction.player}'s turn was skipped (${typedAction.reason})`);
          return true;
        },
      };

      const handler = handlers[action.type as MahjongActionType];
      if (!handler) return false;

      return handler(action);
    },
    [gameState.your_seat, setPlayingProcessing]
  );

  return {
    showMahjongDialog,
    mahjongDialogLoading,
    mahjongDeclaredMessage,
    deadHandNotice,
    deadHandPlayers,
    showDeadHandOverlay,
    deadHandOverlayData,
    awaitingMahjongValidation,
    awaitingValidationLoading,
    handleDeclareMahjong,
    handleMahjongConfirm,
    handleMahjongCancel,
    handleMahjongValidationSubmit,
    setDeadHandOverlayVisible: setShowDeadHandOverlay,
    isDeadHand,
    handleUiAction,
  };
}
