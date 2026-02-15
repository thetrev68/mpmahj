import { useCallback, useRef, useState } from 'react';
import type { UIStateAction } from '@/lib/game-events/types';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { Tile } from '@/types/bindings/generated/Tile';

interface UseMahjongDeclarationOptions {
  gameState: GameStateSnapshot;
  sendCommand: (command: GameCommand) => void;
  setPlayingProcessing: (processing: boolean) => void;
  closeCallWindow: () => void;
}

interface UseMahjongDeclarationResult {
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

function getInitialDeadPlayers(gameState: GameStateSnapshot): Set<Seat> {
  return new Set(gameState.players.filter((player) => player.status === 'Dead').map((p) => p.seat));
}

export function useMahjongDeclaration({
  gameState,
  sendCommand,
  setPlayingProcessing,
  closeCallWindow,
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
      if (action.type === 'SET_MAHJONG_DECLARED') {
        setMahjongDeclaredMessage(`${action.player} is declaring Mahjong...`);
        return true;
      }

      if (action.type === 'SET_AWAITING_MAHJONG_VALIDATION') {
        setAwaitingMahjongValidation({
          calledTile: action.calledTile,
          discardedBy: action.discardedBy,
        });
        return true;
      }

      if (action.type === 'SET_MAHJONG_VALIDATED') {
        setMahjongDialogLoading(false);
        setAwaitingValidationLoading(false);
        setAwaitingMahjongValidation(null);
        setMahjongDeclaredMessage(null);
        if (!action.valid) {
          setShowMahjongDialog(false);
          setPlayingProcessing(false);
          setDeadHandNotice('Invalid Mahjong - Hand does not match any pattern');
        }
        return true;
      }

      if (action.type === 'SET_HAND_DECLARED_DEAD') {
        const isLocalPlayer = action.player === gameState.your_seat;
        setDeadHandNotice(
          isLocalPlayer
            ? 'You have a dead hand. You will be skipped for the rest of the game.'
            : `${action.player}'s hand is declared dead: ${action.reason}`
        );
        setDeadHandPlayers((prev) => {
          const next = new Set([...prev, action.player]);
          deadHandPlayersRef.current = next;
          return next;
        });
        if (isLocalPlayer) {
          setDeadHandOverlayData({ player: action.player, reason: action.reason });
          setShowDeadHandOverlay(true);
        }
        return true;
      }

      if (action.type === 'SET_PLAYER_SKIPPED') {
        setDeadHandNotice(`${action.player}'s turn was skipped (${action.reason})`);
        return true;
      }

      if (action.type === 'SET_PLAYER_FORFEITED') {
        const isLocal = action.player === gameState.your_seat;
        const subject = isLocal ? 'You' : action.player;
        const verb = isLocal ? 'forfeited the game' : 'forfeited';
        const suffix = action.reason ? ` (${action.reason})` : '';
        setDeadHandNotice(`${subject} ${verb}${suffix}.`);
        if (isLocal) {
          setPlayingProcessing(true);
          closeCallWindow();
        }
        return false;
      }

      return false;
    },
    [closeCallWindow, gameState.your_seat, setPlayingProcessing]
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
