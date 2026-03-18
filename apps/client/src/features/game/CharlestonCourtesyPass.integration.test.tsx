import { describe, expect, test, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import { createMockWebSocket } from '@/test/mocks/websocket';
import { gameStates } from '@/test/fixtures';
import { GameBoard } from '@/components/game/GameBoard';
import type { PublicEvent } from '@/types/bindings/generated/PublicEvent';
import type { PrivateEvent } from '@/types/bindings/generated/PrivateEvent';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';

describe('US-051: Charleston Courtesy Pass Action Pane', () => {
  let mockWs: ReturnType<typeof createMockWebSocket>;

  const sendPublicEvent = async (event: PublicEvent) => {
    await act(async () => {
      mockWs.triggerMessage(
        JSON.stringify({ kind: 'Event', payload: { event: { Public: event } } })
      );
    });
  };

  const sendPrivateEvent = async (event: PrivateEvent) => {
    await act(async () => {
      mockWs.triggerMessage(
        JSON.stringify({ kind: 'Event', payload: { event: { Private: event } } })
      );
    });
  };

  const getTileByValue = (value: number) => screen.getAllByTestId(new RegExp(`^tile-${value}-`))[0];

  beforeEach(() => {
    mockWs = createMockWebSocket();
    vi.clearAllMocks();
  });

  test('renders the two-button CourtesyAcross action pane without courtesy overlays', () => {
    renderWithProviders(
      <GameBoard initialState={gameStates.charlestonCourtesyAcross} ws={mockWs} />
    );

    expect(screen.getByTestId('action-instruction')).toHaveTextContent(
      'Select 0–3 tiles to pass across, then press Proceed.'
    );
    expect(screen.getByTestId('proceed-button')).toBeInTheDocument();
    expect(screen.getByTestId('declare-mahjong-button')).toBeInTheDocument();
    expect(screen.getByTestId('declare-mahjong-button')).toBeDisabled();
    expect(screen.queryByTestId('courtesy-pass-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('courtesy-negotiation-status')).not.toBeInTheDocument();
    expect(screen.queryByTestId('courtesy-pass-tiles-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pass-tiles-button')).not.toBeInTheDocument();
  });

  test('submits a courtesy proposal through proceed using staged tiles', async () => {
    const { user } = renderWithProviders(
      <GameBoard initialState={gameStates.charlestonCourtesyAcross} ws={mockWs} />
    );

    await user.click(getTileByValue(2));
    await user.click(getTileByValue(5));
    await user.click(screen.getByTestId('proceed-button'));

    const expectedCommand: GameCommand = {
      ProposeCourtesyPass: { player: 'South', tile_count: 2 },
    };
    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({ kind: 'Command', payload: { command: expectedCommand } })
    );

    await waitFor(() => {
      expect(screen.getByTestId('action-instruction')).toHaveTextContent(
        'Courtesy pass submitted. Waiting for player across...'
      );
    });
    expect(screen.getByTestId('proceed-button')).toBeDisabled();
    expect(screen.getByTestId('declare-mahjong-button')).toBeDisabled();
  });

  test('keeps the two-button model after agreement and enables proceed for the agreed tile count', async () => {
    const { user } = renderWithProviders(
      <GameBoard initialState={gameStates.charlestonCourtesyAcross} ws={mockWs} />
    );

    await user.click(getTileByValue(2));
    await user.click(getTileByValue(5));
    await user.click(screen.getByTestId('proceed-button'));

    await sendPrivateEvent({
      CourtesyPairReady: { pair: ['South', 'North'], tile_count: 2 },
    });

    await waitFor(() => {
      expect(screen.getByTestId('selection-counter')).toHaveTextContent('2/2');
    });
    expect(screen.getByTestId('proceed-button')).toBeEnabled();
    expect(screen.getByTestId('declare-mahjong-button')).toBeInTheDocument();
    expect(screen.queryByTestId('courtesy-pass-panel')).not.toBeInTheDocument();
  });

  test('clears down to the agreed mismatch count and keeps old courtesy overlays absent', async () => {
    const { user } = renderWithProviders(
      <GameBoard initialState={gameStates.charlestonCourtesyAcross} ws={mockWs} />
    );

    await user.click(getTileByValue(2));
    await user.click(getTileByValue(5));
    await user.click(getTileByValue(8));
    await user.click(screen.getByTestId('proceed-button'));

    await sendPrivateEvent({
      CourtesyPassMismatch: {
        pair: ['South', 'North'],
        proposed: [3, 1],
        agreed_count: 1,
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId('selection-counter')).toHaveTextContent('0/1');
    });
    expect(screen.getByTestId('proceed-button')).toBeDisabled();
    expect(screen.getByTestId('declare-mahjong-button')).toBeInTheDocument();
    expect(screen.queryByTestId('courtesy-negotiation-status')).not.toBeInTheDocument();
  });

  test('submits AcceptCourtesyPass through proceed once the agreed tiles are selected', async () => {
    const { user } = renderWithProviders(
      <GameBoard initialState={gameStates.charlestonCourtesyAcross} ws={mockWs} />
    );

    await user.click(getTileByValue(2));
    await user.click(getTileByValue(5));
    await user.click(screen.getByTestId('proceed-button'));

    await sendPrivateEvent({
      CourtesyPairReady: { pair: ['South', 'North'], tile_count: 2 },
    });

    await waitFor(() => expect(screen.getByTestId('selection-counter')).toHaveTextContent('2/2'));
    await user.click(screen.getByTestId('proceed-button'));

    const expectedCommand: GameCommand = {
      AcceptCourtesyPass: { player: 'South', tiles: [2, 5] },
    };
    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({ kind: 'Command', payload: { command: expectedCommand } })
    );
  });

  test('keeps proceed rendered and disabled when the courtesy pass resolves to zero', async () => {
    const { user } = renderWithProviders(
      <GameBoard initialState={gameStates.charlestonCourtesyAcross} ws={mockWs} />
    );

    await user.click(screen.getByTestId('proceed-button'));

    await sendPrivateEvent({
      CourtesyPairReady: { pair: ['South', 'North'], tile_count: 0 },
    });

    await waitFor(() => {
      expect(screen.getByTestId('action-instruction')).toHaveTextContent(
        'Courtesy pass submitted. Waiting for player across...'
      );
    });
    expect(screen.getByTestId('proceed-button')).toBeDisabled();
    expect(screen.getByTestId('declare-mahjong-button')).toBeDisabled();
    expect(screen.getByTestId('selection-counter')).toHaveTextContent('0/3');
  });

  test('resets courtesy overlay state cleanly after CourtesyPassComplete', async () => {
    const { user } = renderWithProviders(
      <GameBoard initialState={gameStates.charlestonCourtesyAcross} ws={mockWs} />
    );

    await user.click(getTileByValue(2));
    await user.click(getTileByValue(5));
    await user.click(screen.getByTestId('proceed-button'));

    await sendPrivateEvent({
      CourtesyPairReady: { pair: ['South', 'North'], tile_count: 2 },
    });

    await sendPublicEvent('CourtesyPassComplete');
    await sendPublicEvent({ CharlestonPhaseChanged: { stage: 'Complete' } });

    await waitFor(() => {
      expect(screen.queryByTestId('courtesy-pass-panel')).not.toBeInTheDocument();
    });
    expect(screen.queryByTestId('courtesy-negotiation-status')).not.toBeInTheDocument();
  });
});
