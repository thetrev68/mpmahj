import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { loadHintSettings, saveHintSettings, type HintSettings } from '@/lib/hintSettings';
import type { ServerEventNotification } from '@/lib/game-events/types';
import { buildTileInstances } from '@/lib/utils/tileSelection';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { HintData } from '@/types/bindings/generated/HintData';

export interface UseHintSystemOptions {
  gameState: GameStateSnapshot;
  canRequestHintInCurrentPhase: boolean;
  isHistoricalView: boolean;
  sendCommand: (command: GameCommand) => void;
}

export interface UseHintSystemResult {
  hintSettings: HintSettings;
  showHintSettings: boolean;
  hintStatusMessage: string | null;
  hintError: string | null;
  showHintRequestDialog: boolean;
  hintPending: boolean;
  currentHint: HintData | null;
  canRequestHint: boolean;
  hintHighlightedIds: string[];
  setShowHintSettings: (show: boolean) => void;
  setShowHintRequestDialog: (show: boolean) => void;
  setCurrentHint: (hint: HintData | null) => void;
  openHintRequestDialog: () => void;
  handleHintSettingsChange: (nextSettings: HintSettings) => void;
  handleRequestHint: () => void;
  cancelHintRequest: () => void;
  handleServerEvent: (event: ServerEventNotification) => boolean;
  resetForTurnChange: () => void;
}

export function useHintSystem({
  gameState,
  canRequestHintInCurrentPhase,
  isHistoricalView,
  sendCommand,
}: UseHintSystemOptions): UseHintSystemResult {
  const [hintSettings, setHintSettings] = useState<HintSettings>(() => loadHintSettings());
  const [showHintSettings, setShowHintSettings] = useState(false);
  const [hintStatusMessage, setHintStatusMessage] = useState<string | null>(null);
  const [hintError, setHintError] = useState<string | null>(null);
  const [showHintRequestDialog, setShowHintRequestDialog] = useState(false);
  const [hintPending, setHintPending] = useState(false);
  const [currentHint, setCurrentHint] = useState<HintData | null>(null);
  const hintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { playSound } = useSoundEffects();

  const localPlayerInfo = useMemo(
    () => gameState.players.find((player) => player.seat === gameState.your_seat) ?? null,
    [gameState.players, gameState.your_seat]
  );
  const canRequestHint =
    canRequestHintInCurrentPhase && !isHistoricalView && !localPlayerInfo?.is_bot;

  const hintHighlightedIds = useMemo(() => {
    if (!currentHint || currentHint.recommended_discard === null) return [];
    const tile = currentHint.recommended_discard;
    const matchingTile = buildTileInstances(gameState.your_hand).find(
      (instance) => instance.tile === tile
    );
    return matchingTile ? [matchingTile.id] : [];
  }, [currentHint, gameState.your_hand]);

  const clearHintTimeout = useCallback(() => {
    if (!hintTimeoutRef.current) return;
    clearTimeout(hintTimeoutRef.current);
    hintTimeoutRef.current = null;
  }, []);

  const handleHintSettingsChange = useCallback(
    (nextSettings: HintSettings) => {
      setHintSettings(nextSettings);
      saveHintSettings(nextSettings);
      setHintStatusMessage(nextSettings.useHints ? 'Hints enabled' : 'Hints disabled');

      if (!nextSettings.useHints) {
        clearHintTimeout();
        setHintPending(false);
        setCurrentHint(null);
        setHintError(null);
        setShowHintRequestDialog(false);
      }
    },
    [clearHintTimeout]
  );

  const handleRequestHint = useCallback(() => {
    if (!canRequestHint || hintPending || !hintSettings.useHints) return;

    setHintError(null);
    setHintPending(true);
    setShowHintRequestDialog(false);
    clearHintTimeout();
    hintTimeoutRef.current = setTimeout(() => {
      setHintPending(false);
      setHintError('Hint request timed out. Please try again.');
    }, 10000);

    sendCommand({
      RequestHint: {
        player: gameState.your_seat,
      },
    });
  }, [
    canRequestHint,
    clearHintTimeout,
    gameState.your_seat,
    hintPending,
    hintSettings.useHints,
    sendCommand,
  ]);

  const cancelHintRequest = useCallback(() => {
    clearHintTimeout();
    setHintPending(false);
    setHintError(null);
  }, [clearHintTimeout]);

  const handleServerEvent = useCallback(
    (event: ServerEventNotification) => {
      if (event.type !== 'hint-update') {
        return false;
      }

      clearHintTimeout();
      setHintPending(false);
      setHintError(null);

      if (!hintSettings.useHints) {
        setCurrentHint(null);
        return true;
      }

      setCurrentHint(event.hint);
      setHintStatusMessage('Hint received');
      playSound('mahjong');
      return true;
    },
    [clearHintTimeout, hintSettings.useHints, playSound]
  );

  const resetForTurnChange = useCallback(() => {
    clearHintTimeout();
    setHintPending(false);
    setCurrentHint(null);
    setHintError(null);
    setShowHintRequestDialog(false);
  }, [clearHintTimeout]);

  const openHintRequestDialog = useCallback(() => {
    if (!canRequestHint || !hintSettings.useHints) {
      return;
    }

    setHintError(null);
    setShowHintRequestDialog(true);
  }, [canRequestHint, hintSettings.useHints]);

  useEffect(() => {
    if (!hintStatusMessage) return;
    const timer = setTimeout(() => setHintStatusMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [hintStatusMessage]);

  useEffect(() => {
    if (isHistoricalView) {
      return;
    }

    sendCommand({
      SetHintEnabled: {
        player: gameState.your_seat,
        enabled: hintSettings.useHints,
      },
    });
  }, [gameState.your_seat, hintSettings.useHints, isHistoricalView, sendCommand]);

  useEffect(() => clearHintTimeout, [clearHintTimeout]);

  return {
    hintSettings,
    showHintSettings,
    hintStatusMessage,
    hintError,
    showHintRequestDialog,
    hintPending,
    currentHint,
    canRequestHint,
    hintHighlightedIds,
    setShowHintSettings,
    setShowHintRequestDialog,
    setCurrentHint,
    openHintRequestDialog,
    handleHintSettingsChange,
    handleRequestHint,
    cancelHintRequest,
    handleServerEvent,
    resetForTurnChange,
  };
}
