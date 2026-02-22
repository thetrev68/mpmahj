import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import {
  DEFAULT_HINT_SETTINGS,
  loadHintSettings,
  saveHintSettings,
  type HintSettings,
  type HintSoundType,
} from '@/lib/hintSettings';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { HintData } from '@/types/bindings/generated/HintData';
import type { HintVerbosity } from '@/types/bindings/generated/HintVerbosity';
import type { Seat } from '@/types/bindings/generated/Seat';

export interface UseHintSystemOptions {
  gameState: GameStateSnapshot;
  isDiscardingStage: boolean;
  isHistoricalView: boolean;
  forfeitedPlayers: Set<Seat>;
  sendCommand: (command: GameCommand) => void;
}

export interface UseHintSystemResult {
  hintSettings: HintSettings;
  showHintSettings: boolean;
  hintStatusMessage: string | null;
  showHintRequestDialog: boolean;
  requestVerbosity: HintVerbosity;
  hintPending: boolean;
  currentHint: HintData | null;
  showHintPanel: boolean;
  canRequestHint: boolean;
  hintHighlightedIds: string[];
  setShowHintSettings: (show: boolean) => void;
  setShowHintRequestDialog: (show: boolean) => void;
  setShowHintPanel: (show: boolean) => void;
  setCurrentHint: (hint: HintData | null) => void;
  setRequestVerbosity: (verbosity: HintVerbosity) => void;
  openHintRequestDialog: () => void;
  handleHintSettingsChange: (nextSettings: HintSettings) => void;
  handleResetHintSettings: () => void;
  handleTestHintSound: (soundType: HintSoundType) => void;
  handleRequestHint: () => void;
  cancelHintRequest: () => void;
  handleServerEvent: (data: unknown) => boolean;
  resetForTurnChange: () => void;
}

/** Maps a HintSoundType to the corresponding sound effect name. */
function hintSoundName(soundType: HintSoundType): 'mahjong' | 'tile-draw' | 'tile-call' {
  if (soundType === 'Chime') return 'mahjong';
  if (soundType === 'Ping') return 'tile-draw';
  return 'tile-call';
}

export function useHintSystem({
  gameState,
  isDiscardingStage,
  isHistoricalView,
  forfeitedPlayers,
  sendCommand,
}: UseHintSystemOptions): UseHintSystemResult {
  const [hintSettings, setHintSettings] = useState<HintSettings>(() => loadHintSettings());
  const [showHintSettings, setShowHintSettings] = useState(false);
  const [hintStatusMessage, setHintStatusMessage] = useState<string | null>(null);
  const [showHintRequestDialog, setShowHintRequestDialog] = useState(false);
  const [requestVerbosity, setRequestVerbosityState] = useState<HintVerbosity>(
    () => loadHintSettings().verbosity
  );
  const [hintPending, setHintPending] = useState(false);
  const [currentHint, setCurrentHint] = useState<HintData | null>(null);
  const [showHintPanel, setShowHintPanel] = useState(false);
  const hintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { playSound } = useSoundEffects({
    enabled: hintSettings.sound_enabled,
  });

  const localPlayerInfo = useMemo(
    () => gameState.players.find((player) => player.seat === gameState.your_seat) ?? null,
    [gameState.players, gameState.your_seat]
  );
  const canRequestHint =
    isDiscardingStage &&
    gameState.your_hand.length === 14 &&
    !isHistoricalView &&
    !forfeitedPlayers.has(gameState.your_seat) &&
    !localPlayerInfo?.is_bot;

  const hintHighlightedIds = useMemo(() => {
    if (!currentHint || currentHint.recommended_discard === null) return [];
    const tile = currentHint.recommended_discard;
    const index = gameState.your_hand.findIndex((handTile) => handTile === tile);
    return index >= 0 ? [`${tile}-${index}`] : [];
  }, [currentHint, gameState.your_hand]);

  const clearHintTimeout = useCallback(() => {
    if (!hintTimeoutRef.current) return;
    clearTimeout(hintTimeoutRef.current);
    hintTimeoutRef.current = null;
  }, []);

  const handleHintSettingsChange = useCallback(
    (nextSettings: HintSettings) => {
      setHintSettings(nextSettings);
      setRequestVerbosityState(nextSettings.verbosity);
      saveHintSettings(nextSettings);
      setHintStatusMessage(`Hint verbosity set to ${nextSettings.verbosity}`);
      if (!isHistoricalView && !forfeitedPlayers.has(gameState.your_seat)) {
        sendCommand({
          SetHintVerbosity: {
            player: gameState.your_seat,
            verbosity: nextSettings.verbosity,
          },
        });
      }
    },
    [forfeitedPlayers, gameState.your_seat, isHistoricalView, sendCommand]
  );

  const handleResetHintSettings = useCallback(() => {
    const confirmed = window.confirm('Reset to default hint settings?');
    if (!confirmed) return;
    handleHintSettingsChange(DEFAULT_HINT_SETTINGS);
  }, [handleHintSettingsChange]);

  const handleTestHintSound = useCallback(
    (soundType: HintSoundType) => {
      if (!hintSettings.sound_enabled) return;
      playSound(hintSoundName(soundType));
    },
    [hintSettings.sound_enabled, playSound]
  );

  const handleRequestHint = useCallback(() => {
    if (!canRequestHint || hintPending) return;
    setHintPending(true);
    setShowHintRequestDialog(false);
    clearHintTimeout();
    hintTimeoutRef.current = setTimeout(() => {
      setHintPending(false);
      setHintStatusMessage('Hint request timed out. Please try again.');
    }, 10000);
    sendCommand({
      RequestHint: {
        player: gameState.your_seat,
        verbosity: requestVerbosity,
      },
    });
  }, [
    canRequestHint,
    clearHintTimeout,
    gameState.your_seat,
    hintPending,
    requestVerbosity,
    sendCommand,
  ]);

  const cancelHintRequest = useCallback(() => {
    clearHintTimeout();
    setHintPending(false);
  }, [clearHintTimeout]);

  const handleServerEvent = useCallback(
    (data: unknown) => {
      const event = data as { Public?: unknown; Analysis?: unknown };
      if (!event || typeof event !== 'object') return false;
      if (!('Analysis' in event)) return false;
      const analysis = event.Analysis;
      if (typeof analysis !== 'object' || analysis === null || !('HintUpdate' in analysis)) {
        return false;
      }
      const hint = (analysis as { HintUpdate: { hint: HintData } }).HintUpdate.hint;
      clearHintTimeout();
      setHintPending(false);
      setCurrentHint(hint);
      setShowHintPanel(true);
      setHintStatusMessage('Hint received');
      if (hintSettings.sound_enabled) {
        playSound(hintSoundName(hintSettings.sound_type));
      }
      return true;
    },
    [clearHintTimeout, hintSettings.sound_enabled, hintSettings.sound_type, playSound]
  );

  const resetForTurnChange = useCallback(() => {
    clearHintTimeout();
    setHintPending(false);
    setCurrentHint(null);
    setShowHintPanel(false);
    setShowHintRequestDialog(false);
  }, [clearHintTimeout]);

  const openHintRequestDialog = useCallback(() => {
    setRequestVerbosityState(hintSettings.verbosity);
    setShowHintRequestDialog(true);
  }, [hintSettings.verbosity]);

  useEffect(() => {
    if (!hintStatusMessage) return;
    const timer = setTimeout(() => setHintStatusMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [hintStatusMessage]);

  useEffect(() => clearHintTimeout, [clearHintTimeout]);

  return {
    hintSettings,
    showHintSettings,
    hintStatusMessage,
    showHintRequestDialog,
    requestVerbosity,
    hintPending,
    currentHint,
    showHintPanel,
    canRequestHint,
    hintHighlightedIds,
    setShowHintSettings,
    setShowHintRequestDialog,
    setShowHintPanel,
    setCurrentHint,
    setRequestVerbosity: setRequestVerbosityState,
    openHintRequestDialog,
    handleHintSettingsChange,
    handleResetHintSettings,
    handleTestHintSound,
    handleRequestHint,
    cancelHintRequest,
    handleServerEvent,
    resetForTurnChange,
  };
}
