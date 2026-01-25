import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import { useGameStore } from '@/store/gameStore';
import { useHandStats, usePatterns } from '@/store/analysisStore';
import { Commands } from '@/utils/commands';

interface UseHandAnalysisOptions {
  isOpen?: boolean;
  sendCommand?: (command: GameCommand) => boolean;
}

export function useHandAnalysis({ isOpen = false, sendCommand }: UseHandAnalysisOptions) {
  const yourSeat = useGameStore((state) => state.yourSeat);
  const patterns = usePatterns();
  const handStats = useHandStats();

  const [isLoading, setIsLoading] = useState(false);
  const lastPatternsRef = useRef<typeof patterns>(patterns);
  const lastHandStatsRef = useRef<typeof handStats>(handStats);

  const requestAnalysis = useCallback(() => {
    if (!sendCommand || !yourSeat) {
      return false;
    }

    lastPatternsRef.current = patterns;
    lastHandStatsRef.current = handStats;
    setIsLoading(true);

    const sent = sendCommand(Commands.getAnalysis(yourSeat));
    if (!sent) {
      setIsLoading(false);
    }
    return sent;
  }, [sendCommand, yourSeat, patterns, handStats]);

  // Trigger analysis request when panel opens
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    // Use a timeout to defer the request outside of the effect
    const timer = setTimeout(() => {
      requestAnalysis();
    }, 0);
    return () => clearTimeout(timer);
  }, [isOpen, requestAnalysis]);

  // Watch for analysis results and clear loading state
  useEffect(() => {
    if (!isLoading) {
      return;
    }

    if (patterns !== lastPatternsRef.current || handStats !== lastHandStatsRef.current) {
      // Use a timeout to defer state updates outside of the effect
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [patterns, handStats, isLoading]);

  return {
    patterns,
    handStats,
    isLoading,
    requestAnalysis,
  };
}
