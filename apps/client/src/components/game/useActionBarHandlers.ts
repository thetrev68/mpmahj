import { useCallback, useMemo, useState } from 'react';
import {
  ACTION_BUTTON_DEBOUNCE_MS,
  LEAVE_FORFEIT_OVERLAY_DURATION_MS,
} from '@/lib/constants';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { Seat } from '@/types/bindings/generated/Seat';

interface UseActionBarHandlersOptions {
  mySeat: Seat;
  isProcessing: boolean;
  disabled: boolean;
  canForfeit: boolean;
  onCommand: (command: GameCommand) => void;
  onLeaveConfirmed?: () => void;
}

export function useActionBarHandlers({
  mySeat,
  isProcessing,
  disabled,
  canForfeit,
  onCommand,
  onLeaveConfirmed,
}: UseActionBarHandlersOptions) {
  const [localProcessing, setLocalProcessing] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showForfeitDialog, setShowForfeitDialog] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isForfeiting, setIsForfeiting] = useState(false);
  const [forfeitReason, setForfeitReason] = useState<string | null>(null);
  const [leaveButtonLocked, setLeaveButtonLocked] = useState(false);

  const isBusy = useMemo(() => localProcessing || isProcessing, [localProcessing, isProcessing]);

  const handleCommand = useCallback(
    (command: GameCommand) => {
      if (isBusy || disabled) return;

      setLocalProcessing(true);
      onCommand(command);
      setTimeout(() => setLocalProcessing(false), ACTION_BUTTON_DEBOUNCE_MS);
    },
    [disabled, isBusy, onCommand]
  );

  const handleOpenLeaveDialog = useCallback(() => {
    if (disabled || leaveButtonLocked || isLeaving) return;
    setLeaveButtonLocked(true);
    setShowLeaveDialog(true);
  }, [disabled, isLeaving, leaveButtonLocked]);

  const handleCancelLeave = useCallback(() => {
    setShowLeaveDialog(false);
    setLeaveButtonLocked(false);
  }, []);

  const handleConfirmLeave = useCallback(() => {
    if (isLeaving) return;
    setShowLeaveDialog(false);
    setIsLeaving(true);
    onCommand({ LeaveGame: { player: mySeat } });
    setTimeout(() => {
      setIsLeaving(false);
      setLeaveButtonLocked(false);
      onLeaveConfirmed?.();
    }, LEAVE_FORFEIT_OVERLAY_DURATION_MS);
  }, [isLeaving, mySeat, onCommand, onLeaveConfirmed]);

  const handleOpenForfeitDialog = useCallback(() => {
    if (disabled) return;
    setShowForfeitDialog(true);
  }, [disabled]);

  const handleConfirmForfeit = useCallback(() => {
    if (isForfeiting || !canForfeit) return;
    setShowForfeitDialog(false);
    setIsForfeiting(true);
    onCommand({
      ForfeitGame: {
        player: mySeat,
        reason: forfeitReason,
      },
    });
    setTimeout(() => setIsForfeiting(false), LEAVE_FORFEIT_OVERLAY_DURATION_MS);
  }, [canForfeit, forfeitReason, isForfeiting, mySeat, onCommand]);

  const handleCancelForfeit = useCallback(() => {
    setShowForfeitDialog(false);
  }, []);

  return {
    forfeitReason,
    handleCancelForfeit,
    handleCancelLeave,
    handleCommand,
    handleConfirmForfeit,
    handleConfirmLeave,
    handleOpenForfeitDialog,
    handleOpenLeaveDialog,
    isBusy,
    isForfeiting,
    isLeaving,
    setForfeitReason,
    showForfeitDialog,
    showLeaveDialog,
  };
}
