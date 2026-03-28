import type { SoundEffect } from '@/hooks/useSoundEffects';
import type { SideEffect, UIStateAction } from './types';
import { SideEffectManager } from './sideEffectManager';

function getTimeoutCleanupActions(id: string): UIStateAction[] {
  switch (id) {
    case 'bot-pass-message':
      return [{ type: 'SET_BOT_PASS_MESSAGE', message: null }];
    case 'bot-vote-message':
      return [{ type: 'SET_BOT_VOTE_MESSAGE', message: null }];
    case 'pass-direction':
      return [{ type: 'SET_PASS_DIRECTION', direction: null }];
    case 'incoming-seat':
      return [{ type: 'SET_INCOMING_FROM_SEAT', seat: null }];
    case 'highlight-tiles':
    case 'highlight-drawn-tile':
      return [{ type: 'SET_HIGHLIGHTED_TILE_IDS', ids: [] }];
    case 'leaving-tiles':
      return [{ type: 'SET_LEAVING_TILE_IDS', ids: [] }, { type: 'CLEAR_SELECTION' }];
    case 'error-message':
    case 'wall-exhausted-message':
    case 'call-window-info':
    case 'call-resolution-message':
      return [{ type: 'SET_ERROR_MESSAGE', message: null }];
    case 'clear-recent-discard':
      return [
        { type: 'SET_MOST_RECENT_DISCARD', tile: null },
        { type: 'SET_DISCARD_ANIMATION_TILE', tile: null },
      ];
    case 'iou-overlay':
      return [{ type: 'CLEAR_IOU' }];
    default:
      return [];
  }
}

export interface EventSideEffectContext {
  playSound: (sound: SoundEffect) => void;
  executeUIActions: (actions: UIStateAction[]) => void;
  sideEffectManager: SideEffectManager;
}

export function executeSideEffects(effects: SideEffect[], context: EventSideEffectContext): void {
  const { playSound, executeUIActions, sideEffectManager } = context;

  effects.forEach((effect) => {
    if (effect.type === 'PLAY_SOUND') {
      playSound(effect.sound);
      return;
    }

    if (effect.type === 'TIMEOUT') {
      const cleanupActions = getTimeoutCleanupActions(effect.id);
      const onFire = cleanupActions.length > 0 ? () => executeUIActions(cleanupActions) : undefined;
      sideEffectManager.execute(effect, onFire);
      return;
    }

    sideEffectManager.execute(effect);
  });
}
