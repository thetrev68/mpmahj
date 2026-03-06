import type { Dispatch, SetStateAction } from 'react';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { EventHandlerResult, SideEffect, UIStateAction } from './types';

export interface EventResultContext {
  setServerSnapshot: Dispatch<SetStateAction<GameStateSnapshot | null>>;
  executeUIActions: (actions: UIStateAction[]) => void;
  executeSideEffects: (effects: SideEffect[]) => void;
}

export function applyEventHandlerResult(
  result: EventHandlerResult,
  context: EventResultContext
): void {
  const { setServerSnapshot, executeUIActions, executeSideEffects } = context;

  if (result.stateUpdates.length > 0) {
    setServerSnapshot((prev) =>
      result.stateUpdates.reduce((state, updater) => updater(state), prev)
    );
  }

  if (result.uiActions.length > 0) {
    executeUIActions(result.uiActions);
  }

  if (result.sideEffects.length > 0) {
    executeSideEffects(result.sideEffects);
  }
}
