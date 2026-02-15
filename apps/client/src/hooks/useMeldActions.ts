import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  findUpgradeableMelds,
  type UpgradeOpportunity,
} from '@/lib/game-logic/meldUpgradeDetector';
import { isTypingTarget } from '@/lib/utils/dom';
import type { UIStateAction } from '@/lib/game-events/types';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { ExchangeOpportunity } from '@/components/game/JokerExchangeDialog';

interface UseMeldActionsOptions {
  gameState: GameStateSnapshot;
  isDiscardingStage: boolean;
  sendCommand: (command: GameCommand) => void;
}

interface UseMeldActionsResult {
  jokerExchangeOpportunities: ExchangeOpportunity[];
  canExchangeJoker: boolean;
  showJokerExchangeDialog: boolean;
  jokerExchangeLoading: boolean;
  upgradeDialogState: UpgradeOpportunity | null;
  upgradeDialogLoading: boolean;
  upgradeableMeldIndices: number[];
  handleOpenJokerExchange: () => void;
  handleJokerExchange: (opportunity: ExchangeOpportunity) => void;
  handleCloseJokerExchange: () => void;
  handleMeldClick: (meldIndex: number) => void;
  handleUpgradeConfirm: (command: GameCommand) => void;
  handleUpgradeCancel: () => void;
  handleUiAction: (action: UIStateAction) => boolean;
}

export function useMeldActions({
  gameState,
  isDiscardingStage,
  sendCommand,
}: UseMeldActionsOptions): UseMeldActionsResult {
  const [showJokerExchangeDialog, setShowJokerExchangeDialog] = useState(false);
  const [jokerExchangeLoading, setJokerExchangeLoading] = useState(false);
  const [upgradeDialogState, setUpgradeDialogState] = useState<UpgradeOpportunity | null>(null);
  const [upgradeDialogLoading, setUpgradeDialogLoading] = useState(false);

  const jokerExchangeOpportunities = useMemo((): ExchangeOpportunity[] => {
    if (!isDiscardingStage) return [];

    const opportunities: ExchangeOpportunity[] = [];
    const myTiles = new Set(gameState.your_hand);

    for (const player of gameState.players) {
      if (player.seat === gameState.your_seat) continue;

      const exposedMelds = Array.isArray(player.exposed_melds) ? player.exposed_melds : [];
      exposedMelds.forEach((meld, meldIndex) => {
        if (!meld || typeof meld !== 'object') return;
        const jokerAssignments =
          meld.joker_assignments && typeof meld.joker_assignments === 'object'
            ? meld.joker_assignments
            : {};
        Object.entries(jokerAssignments).forEach(([posStr, representedTile]) => {
          if (representedTile == null) return;
          const tilePosition = parseInt(posStr, 10);
          if (myTiles.has(representedTile)) {
            opportunities.push({
              targetSeat: player.seat,
              meldIndex,
              tilePosition,
              representedTile,
            });
          }
        });
      });
    }

    return opportunities;
  }, [gameState.players, gameState.your_hand, gameState.your_seat, isDiscardingStage]);

  const upgradeOpportunities = useMemo((): UpgradeOpportunity[] => {
    if (!isDiscardingStage) return [];
    const myPlayer = gameState.players.find((player) => player.seat === gameState.your_seat);
    if (!myPlayer) return [];
    return findUpgradeableMelds(myPlayer.exposed_melds, gameState.your_hand);
  }, [gameState.players, gameState.your_hand, gameState.your_seat, isDiscardingStage]);

  const upgradeableMeldIndices = useMemo(
    () => upgradeOpportunities.map((opportunity) => opportunity.meldIndex),
    [upgradeOpportunities]
  );

  const canExchangeJoker = jokerExchangeOpportunities.length > 0;

  const handleOpenJokerExchange = useCallback(() => {
    setShowJokerExchangeDialog(true);
  }, []);

  const handleJokerExchange = useCallback(
    (opportunity: ExchangeOpportunity) => {
      setJokerExchangeLoading(true);
      sendCommand({
        ExchangeJoker: {
          player: gameState.your_seat,
          target_seat: opportunity.targetSeat,
          meld_index: opportunity.meldIndex,
          replacement: opportunity.representedTile,
        },
      });
    },
    [gameState.your_seat, sendCommand]
  );

  const handleCloseJokerExchange = useCallback(() => {
    setShowJokerExchangeDialog(false);
    setJokerExchangeLoading(false);
  }, []);

  const handleMeldClick = useCallback(
    (meldIndex: number) => {
      const opportunity = upgradeOpportunities.find((entry) => entry.meldIndex === meldIndex);
      if (!opportunity) return;
      setUpgradeDialogState(opportunity);
      setUpgradeDialogLoading(false);
    },
    [upgradeOpportunities]
  );

  const handleUpgradeConfirm = useCallback(
    (command: GameCommand) => {
      setUpgradeDialogLoading(true);
      sendCommand(command);
    },
    [sendCommand]
  );

  const handleUpgradeCancel = useCallback(() => {
    setUpgradeDialogState(null);
    setUpgradeDialogLoading(false);
  }, []);

  const handleUiAction = useCallback((action: UIStateAction) => {
    if (action.type === 'SET_ERROR_MESSAGE') {
      setJokerExchangeLoading(false);
      return false;
    }

    if (action.type === 'SET_JOKER_EXCHANGED') {
      setShowJokerExchangeDialog(false);
      setJokerExchangeLoading(false);
      return true;
    }

    if (action.type === 'SET_MELD_UPGRADED') {
      setUpgradeDialogState(null);
      setUpgradeDialogLoading(false);
      return true;
    }

    return false;
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'j' && event.key !== 'J') return;
      if (isTypingTarget(event.target)) return;
      if (showJokerExchangeDialog) return;
      if (jokerExchangeOpportunities.length === 0) return;
      event.preventDefault();
      setShowJokerExchangeDialog(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [jokerExchangeOpportunities, showJokerExchangeDialog]);

  return {
    jokerExchangeOpportunities,
    canExchangeJoker,
    showJokerExchangeDialog,
    jokerExchangeLoading,
    upgradeDialogState,
    upgradeDialogLoading,
    upgradeableMeldIndices,
    handleOpenJokerExchange,
    handleJokerExchange,
    handleCloseJokerExchange,
    handleMeldClick,
    handleUpgradeConfirm,
    handleUpgradeCancel,
    handleUiAction,
  };
}
