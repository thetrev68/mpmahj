import { useCallback, useMemo, useState } from 'react';
import {
  findUpgradeableMelds,
  type UpgradeOpportunity,
} from '@/lib/game-logic/meldUpgradeDetector';
import { getTileName } from '@/lib/utils/tileUtils';
import type { UIStateAction } from '@/lib/game-events/types';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { ExchangeOpportunity, ExchangeableJokersBySeat } from '@/types/game/exchange';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { Tile } from '@/types/bindings/generated/Tile';

export interface UseMeldActionsOptions {
  gameState: GameStateSnapshot;
  isDiscardingStage: boolean;
  isMyTurn: boolean;
  readOnly: boolean;
  isBusy: boolean;
  sendCommand: (command: GameCommand) => void;
}

export interface UseMeldActionsResult {
  jokerExchangeOpportunities: ExchangeOpportunity[];
  exchangeableJokersBySeat: ExchangeableJokersBySeat;
  pendingExchangeOpportunity: ExchangeOpportunity | null;
  jokerExchangeLoading: boolean;
  inlineError: string | null;
  upgradeDialogState: UpgradeOpportunity | null;
  upgradeDialogLoading: boolean;
  upgradeableMeldIndices: number[];
  handleJokerTileClick: (seat: Seat, meldIndex: number, tilePosition: number) => void;
  handleConfirmExchange: (stagedTiles: Tile[], concealedHand: Tile[]) => void;
  handleCancelExchange: () => void;
  handleMeldClick: (meldIndex: number) => void;
  handleUpgradeConfirm: (command: GameCommand) => void;
  handleUpgradeCancel: () => void;
  handleUiAction: (action: UIStateAction) => boolean;
}

type MeldActionType = 'SET_ERROR_MESSAGE' | 'SET_JOKER_EXCHANGED' | 'SET_MELD_UPGRADED';

export function useMeldActions({
  gameState,
  isDiscardingStage,
  isMyTurn,
  readOnly,
  isBusy,
  sendCommand,
}: UseMeldActionsOptions): UseMeldActionsResult {
  const [pendingExchangeOpportunity, setPendingExchangeOpportunity] =
    useState<ExchangeOpportunity | null>(null);
  const [jokerExchangeLoading, setJokerExchangeLoading] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [upgradeDialogState, setUpgradeDialogState] = useState<UpgradeOpportunity | null>(null);
  const [upgradeDialogLoading, setUpgradeDialogLoading] = useState(false);
  const canRenderExchangeAffordance =
    isDiscardingStage && isMyTurn && !readOnly && !isBusy && !jokerExchangeLoading;
  const shouldForceClosePending =
    pendingExchangeOpportunity !== null && (!isDiscardingStage || !isMyTurn || readOnly);

  if (shouldForceClosePending) {
    setPendingExchangeOpportunity(null);
    if (inlineError !== null) {
      setInlineError(null);
    }
    if (jokerExchangeLoading) {
      setJokerExchangeLoading(false);
    }
  }

  const jokerExchangeOpportunities = useMemo((): ExchangeOpportunity[] => {
    if (!canRenderExchangeAffordance) return [];

    const opportunities: ExchangeOpportunity[] = [];
    const myTiles = new Set(gameState.your_hand);

    for (const player of gameState.players) {
      for (let meldIndex = 0; meldIndex < player.exposed_melds.length; meldIndex++) {
        const meld = player.exposed_melds[meldIndex];
        const jokerAssignments = meld.joker_assignments ?? {};
        for (const [posStr, representedTile] of Object.entries(jokerAssignments)) {
          if (representedTile == null) continue;
          if (myTiles.has(representedTile)) {
            opportunities.push({
              targetSeat: player.seat,
              meldIndex,
              tilePosition: parseInt(posStr, 10),
              representedTile,
            });
          }
        }
      }
    }

    return opportunities;
  }, [canRenderExchangeAffordance, gameState.players, gameState.your_hand]);

  const exchangeableJokersBySeat = useMemo((): ExchangeableJokersBySeat => {
    const bySeat = gameState.players.reduce((acc, player) => {
      acc[player.seat] = {};
      return acc;
    }, {} as ExchangeableJokersBySeat);

    for (const opportunity of jokerExchangeOpportunities) {
      const seatLookup = bySeat[opportunity.targetSeat] ?? {};
      const positions = seatLookup[opportunity.meldIndex] ?? [];
      seatLookup[opportunity.meldIndex] = [...positions, opportunity.tilePosition];
      bySeat[opportunity.targetSeat] = seatLookup;
    }

    return bySeat;
  }, [gameState.players, jokerExchangeOpportunities]);

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

  const handleCancelExchange = useCallback(() => {
    setPendingExchangeOpportunity(null);
    setInlineError(null);
    setJokerExchangeLoading(false);
  }, []);

  const handleJokerTileClick = useCallback(
    (seat: Seat, meldIndex: number, tilePosition: number) => {
      if (!canRenderExchangeAffordance) return;
      const opportunity =
        jokerExchangeOpportunities.find(
          (entry) =>
            entry.targetSeat === seat &&
            entry.meldIndex === meldIndex &&
            entry.tilePosition === tilePosition
        ) ?? null;
      if (!opportunity) return;
      setPendingExchangeOpportunity(opportunity);
      setInlineError(null);
      setJokerExchangeLoading(false);
    },
    [canRenderExchangeAffordance, jokerExchangeOpportunities]
  );

  const handleConfirmExchange = useCallback(
    (stagedTiles: Tile[], concealedHand: Tile[]) => {
      if (pendingExchangeOpportunity === null) return;
      const representedTile = pendingExchangeOpportunity.representedTile;
      const hasStagedTile = stagedTiles.includes(representedTile);
      const hasConcealedTile = concealedHand.includes(representedTile);

      if (!hasStagedTile && !hasConcealedTile) {
        setInlineError(`You don't have ${getTileName(representedTile)} to exchange.`);
        setJokerExchangeLoading(false);
        return;
      }

      setInlineError(null);
      setJokerExchangeLoading(true);
      sendCommand({
        ExchangeJoker: {
          player: gameState.your_seat,
          target_seat: pendingExchangeOpportunity.targetSeat,
          meld_index: pendingExchangeOpportunity.meldIndex,
          replacement: representedTile,
        },
      });
    },
    [gameState.your_seat, pendingExchangeOpportunity, sendCommand]
  );

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

  const handleUiAction = useCallback(
    (action: UIStateAction) => {
      const handlers: Record<MeldActionType, (typedAction: UIStateAction) => boolean> = {
        SET_ERROR_MESSAGE: () => {
          handleCancelExchange();
          return false;
        },
        SET_JOKER_EXCHANGED: () => {
          handleCancelExchange();
          return true;
        },
        SET_MELD_UPGRADED: () => {
          setUpgradeDialogState(null);
          setUpgradeDialogLoading(false);
          return true;
        },
      };

      const handler = handlers[action.type as MeldActionType];
      if (!handler) return false;

      return handler(action);
    },
    [handleCancelExchange]
  );

  return {
    jokerExchangeOpportunities,
    exchangeableJokersBySeat,
    pendingExchangeOpportunity,
    jokerExchangeLoading,
    inlineError,
    upgradeDialogState,
    upgradeDialogLoading,
    upgradeableMeldIndices,
    handleJokerTileClick,
    handleConfirmExchange,
    handleCancelExchange,
    handleMeldClick,
    handleUpgradeConfirm,
    handleUpgradeCancel,
    handleUiAction,
  };
}
