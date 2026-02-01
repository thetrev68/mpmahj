import { useCallback, useEffect } from 'react';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import { useCommandSender } from '@/utils/commands';
import { useUIStore } from '@/store/uiStore';
import { useUndoState } from '@/hooks/useUndoState';
import './UndoButton.css';

import type { Seat } from '@/types/bindings/generated/Seat';
export function UndoButton({ sendCommand }: { sendCommand: (command: GameCommand) => boolean }) {
  const {
    canUndo,
    lastAction,
    pendingRequest,
    isExecuting,
    isPractice,
    seats,
    setUndoExecuting,
    yourSeat,
  } = useUndoState();
  const addError = useUIStore((state) => state.addError);
  const { smartUndo } = useCommandSender();

  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    const result = smartUndo();
    if (!result.command) {
      addError(result.error || 'Cannot undo right now');
      return;
    }

    const sent = sendCommand(result.command);
    if (sent && isPractice) {
      setUndoExecuting(true);
    }
  }, [addError, canUndo, isPractice, sendCommand, setUndoExecuting, smartUndo]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() !== 'z') return;
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
      }
      if (!canUndo) return;
      event.preventDefault();
      handleUndo();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canUndo, handleUndo]);

  const isRequester = pendingRequest?.requestedBy === yourSeat;
  const showAction = Boolean(lastAction && (canUndo || isRequester));
  const label = showAction && lastAction ? `Undo ${lastAction}` : 'Undo';

  const voteValues = (pendingRequest?.votes as Record<Seat, boolean | null>) ?? {};
  const approvals = seats.filter((seat) => voteValues[seat] === true).length;
  const waitingText = pendingRequest
    ? `Waiting for votes: ${approvals}/${seats.length} approved`
    : '';

  return (
    <div className="undo-button">
      <button onClick={handleUndo} disabled={!canUndo} className="action-neutral">
        {label}
      </button>
      {showAction && lastAction && !pendingRequest && !isExecuting && (
        <div className="undo-hint">Last action: {lastAction}</div>
      )}
      {pendingRequest && isRequester && <div className="undo-status">Undo requested</div>}
      {pendingRequest && <div className="undo-status">{waitingText}</div>}
      {isExecuting && <div className="undo-status">Undoing...</div>}
    </div>
  );
}
