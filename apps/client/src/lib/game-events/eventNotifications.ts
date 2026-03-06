import type { AnalysisEvent } from '@/types/bindings/generated/AnalysisEvent';
import type { PublicEvent } from '@/types/bindings/generated/PublicEvent';
import type { ServerEventNotification } from './types';

export function emitPublicEventNotifications(
  emitServerEvent: (event: ServerEventNotification) => void,
  event: PublicEvent
): void {
  if (event === 'CallWindowClosed') {
    emitServerEvent({ type: 'history-move-call-window-closed' });
    return;
  }

  if (typeof event !== 'object' || event === null) return;

  if ('HistoryList' in event) {
    emitServerEvent({ type: 'history-list', entries: event.HistoryList.entries });
    return;
  }
  if ('HistoryError' in event) {
    emitServerEvent({ type: 'history-error', message: event.HistoryError.message });
    return;
  }
  if ('HistoryTruncated' in event) {
    emitServerEvent({ type: 'history-truncated', fromMove: event.HistoryTruncated.from_move });
    return;
  }
  if ('StateRestored' in event) {
    emitServerEvent({
      type: 'state-restored',
      moveNumber: event.StateRestored.move_number,
      description: event.StateRestored.description,
      mode: event.StateRestored.mode,
    });
    return;
  }
  if ('UndoRequested' in event) {
    emitServerEvent({
      type: 'undo-requested',
      requester: event.UndoRequested.requester,
      targetMove: event.UndoRequested.target_move,
    });
    return;
  }
  if ('UndoVoteRegistered' in event) {
    emitServerEvent({
      type: 'undo-vote-registered',
      voter: event.UndoVoteRegistered.voter,
      approved: event.UndoVoteRegistered.approved,
    });
    return;
  }
  if ('UndoRequestResolved' in event) {
    emitServerEvent({
      type: 'undo-request-resolved',
      approved: event.UndoRequestResolved.approved,
    });
    return;
  }
  if ('TileDiscarded' in event) {
    emitServerEvent({
      type: 'history-move-tile-discarded',
      player: event.TileDiscarded.player,
      tile: event.TileDiscarded.tile,
    });
    return;
  }
  if ('CallWindowOpened' in event) {
    emitServerEvent({
      type: 'history-move-call-window-opened',
      tile: event.CallWindowOpened.tile,
      discardedBy: event.CallWindowOpened.discarded_by,
    });
    return;
  }
  if ('TilesPassing' in event) {
    emitServerEvent({
      type: 'history-move-tiles-passing',
      direction: event.TilesPassing.direction,
    });
  }
}

export function emitAnalysisEventNotifications(
  emitServerEvent: (event: ServerEventNotification) => void,
  event: AnalysisEvent
): void {
  if (typeof event === 'object' && event !== null && 'HintUpdate' in event) {
    emitServerEvent({ type: 'hint-update', hint: event.HintUpdate.hint });
  }
}
