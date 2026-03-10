/**
 * Integration Tests for US-005: Charleston Voting (Stop/Continue)
 *
 * User Story: US-005-charleston-voting.md
 *
 * These tests verify the complete Charleston voting flow:
 * - Voting state is expressed through staging plus Proceed (US-046)
 * - Hand is visible so staged tile count can drive the vote
 * - VoteCharleston command sent on Proceed (AC-2, AC-3)
 * - PlayerVoted events update per-seat indicators (AC-4)
 * - "Waiting for [PlayerName]..." message (AC-4)
 * - VoteResult Stop → CharlestonComplete → Playing (AC-5)
 * - VoteResult Continue → SecondLeft (AC-6)
 * - Bot voting message (AC-9)
 * - Vote result overlay with breakdown (AC-10)
 * - Vote retry on missing ack (EC-7)
 *
 * IMPORTANT: Command/event shapes match backend bindings (source of truth).
 */

import { describe, expect, test, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import { createMockWebSocket } from '@/test/mocks/websocket';
import { gameStates } from '@/test/fixtures';
import { GameBoard } from '@/components/game/GameBoard';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';

describe('US-005: Charleston Voting (Stop/Continue)', () => {
  let mockWs: ReturnType<typeof createMockWebSocket>;

  beforeEach(() => {
    mockWs = createMockWebSocket();
    vi.clearAllMocks();
  });

  /** Helper: send a public event through the mock WebSocket */
  const sendPublicEvent = async (event: Record<string, unknown> | string) => {
    await act(async () => {
      mockWs.triggerMessage(
        JSON.stringify({ kind: 'Event', payload: { event: { Public: event } } })
      );
    });
  };

  /**
   * Helper: vote and immediately acknowledge with PlayerVoted for South.
   * This cancels the 5-second retry timer that would otherwise block act() calls.
   */
  const voteAndAck = async (
    user: ReturnType<typeof import('@testing-library/user-event').default.setup>,
    vote: 'Stop' | 'Continue'
  ) => {
    if (vote === 'Continue') {
      await user.click(screen.getByTestId('tile-3-3-0'));
      await user.click(screen.getByTestId('tile-6-6-0'));
      await user.click(screen.getByTestId('tile-9-9-0'));
      await waitFor(() => expect(screen.getByTestId('proceed-button')).toBeEnabled());
    }

    await user.click(screen.getByTestId('proceed-button'));
    await sendPublicEvent({ PlayerVoted: { player: 'South' } });
  };

  describe('Test 1: Voting phase entry and UI (AC-1)', () => {
    test('displays vote panel with Proceed instead of Stop and Continue buttons', () => {
      renderWithProviders(<GameBoard initialState={gameStates.charlestonVoting} ws={mockWs} />);

      expect(screen.getByTestId('vote-panel')).toBeInTheDocument();
      expect(screen.getByTestId('proceed-button')).toBeInTheDocument();
      expect(screen.queryByTestId('vote-stop-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('vote-continue-button')).not.toBeInTheDocument();
    });

    test('displays charleston tracker with Vote stage', () => {
      renderWithProviders(<GameBoard initialState={gameStates.charlestonVoting} ws={mockWs} />);

      expect(screen.getByTestId('charleston-tracker')).toBeInTheDocument();
      expect(screen.getByTestId('charleston-direction')).toHaveTextContent(/vote/i);
    });

    test('displays instruction message', () => {
      renderWithProviders(<GameBoard initialState={gameStates.charlestonVoting} ws={mockWs} />);

      expect(
        screen.getByText(/stage 3 tiles to continue\. stage 0 tiles to stop\. press proceed/i)
      ).toBeInTheDocument();
    });

    test('hand is visible during voting so staged tile count can drive Proceed', () => {
      renderWithProviders(<GameBoard initialState={gameStates.charlestonVoting} ws={mockWs} />);

      expect(screen.getByTestId('player-rack')).toBeInTheDocument();
      expect(screen.getByTestId('proceed-button')).toBeInTheDocument();
    });
  });

  describe('Test 2: Vote submission (AC-2, AC-3)', () => {
    test('sends VoteCharleston Stop command when Proceed is clicked with no staged tiles', async () => {
      const { user } = renderWithProviders(
        <GameBoard initialState={gameStates.charlestonVoting} ws={mockWs} />
      );

      await voteAndAck(user, 'Stop');

      const expectedCommand: GameCommand = {
        VoteCharleston: { player: 'South', vote: 'Stop' },
      };
      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({ kind: 'Command', payload: { command: expectedCommand } })
      );
    });

    test('sends VoteCharleston Continue command when Proceed is clicked with three staged tiles', async () => {
      const { user } = renderWithProviders(
        <GameBoard initialState={gameStates.charlestonVoting} ws={mockWs} />
      );

      await voteAndAck(user, 'Continue');

      const expectedCommand: GameCommand = {
        VoteCharleston: { player: 'South', vote: 'Continue' },
      };
      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({ kind: 'Command', payload: { command: expectedCommand } })
      );
    });

    test('shows "You voted to STOP" message after voting Stop', async () => {
      const { user } = renderWithProviders(
        <GameBoard initialState={gameStates.charlestonVoting} ws={mockWs} />
      );

      await voteAndAck(user, 'Stop');

      expect(screen.getByTestId('vote-status-message')).toHaveTextContent(
        'You voted to STOP. Waiting for other players...'
      );
    });

    test('shows "You voted to CONTINUE" message after voting Continue', async () => {
      const { user } = renderWithProviders(
        <GameBoard initialState={gameStates.charlestonVoting} ws={mockWs} />
      );

      await voteAndAck(user, 'Continue');

      expect(screen.getByTestId('vote-status-message')).toHaveTextContent(
        'You voted to CONTINUE. Waiting for other players...'
      );
    });
  });

  describe('Test 3: Vote progress tracking (AC-4)', () => {
    test('updates per-seat indicators as players vote', async () => {
      const { user } = renderWithProviders(
        <GameBoard initialState={gameStates.charlestonVoting} ws={mockWs} />
      );

      await voteAndAck(user, 'Stop');

      await sendPublicEvent({ PlayerVoted: { player: 'East' } });
      await sendPublicEvent({ PlayerVoted: { player: 'West' } });

      // Check vote indicators
      expect(screen.getByTestId('vote-indicator-south')).toHaveTextContent('✓');
      expect(screen.getByTestId('vote-indicator-east')).toHaveTextContent('✓');
      expect(screen.getByTestId('vote-indicator-west')).toHaveTextContent('✓');
      expect(screen.getByTestId('vote-indicator-north')).toHaveTextContent('•');
    });

    test('shows vote progress count', async () => {
      const { user } = renderWithProviders(
        <GameBoard initialState={gameStates.charlestonVoting} ws={mockWs} />
      );

      await voteAndAck(user, 'Stop');
      await sendPublicEvent({ PlayerVoted: { player: 'East' } });

      expect(screen.getByTestId('vote-progress')).toHaveTextContent('2/4 players voted');
    });

    test('shows "Waiting for [PlayerName]..." message', async () => {
      const { user } = renderWithProviders(
        <GameBoard initialState={gameStates.charlestonVoting} ws={mockWs} />
      );

      await voteAndAck(user, 'Stop');
      await sendPublicEvent({ PlayerVoted: { player: 'East' } });
      await sendPublicEvent({ PlayerVoted: { player: 'West' } });

      expect(screen.getByTestId('vote-waiting-message')).toHaveTextContent('Waiting for North...');
    });
  });

  describe('Test 4: Vote result - Stop (AC-5, AC-10)', () => {
    test('shows vote result overlay on VoteResult Stop', async () => {
      const { user } = renderWithProviders(
        <GameBoard initialState={gameStates.charlestonVoting} ws={mockWs} />
      );

      await voteAndAck(user, 'Stop');
      await sendPublicEvent({ PlayerVoted: { player: 'East' } });
      await sendPublicEvent({ PlayerVoted: { player: 'West' } });
      await sendPublicEvent({ PlayerVoted: { player: 'North' } });
      await sendPublicEvent({ VoteResult: { result: 'Stop' } });

      expect(screen.getByTestId('vote-result-overlay')).toBeInTheDocument();
      expect(screen.getByTestId('vote-result-title')).toHaveTextContent('Charleston STOPPED');
      expect(screen.getByTestId('vote-result-message')).toHaveTextContent('Main game starting...');
    });

    test('shows user own vote in result overlay', async () => {
      const { user } = renderWithProviders(
        <GameBoard initialState={gameStates.charlestonVoting} ws={mockWs} />
      );

      await voteAndAck(user, 'Stop');
      await sendPublicEvent({ VoteResult: { result: 'Stop' } });

      expect(screen.getByTestId('vote-my-vote')).toHaveTextContent('You voted: Stop');
    });

    test('transitions to Playing phase after CharlestonComplete + PhaseChanged', async () => {
      const { user } = renderWithProviders(
        <GameBoard initialState={gameStates.charlestonVoting} ws={mockWs} />
      );

      await voteAndAck(user, 'Stop');
      await sendPublicEvent({ VoteResult: { result: 'Stop' } });
      await sendPublicEvent('CharlestonComplete');
      await sendPublicEvent({ PhaseChanged: { phase: 'Playing' } });

      expect(screen.queryByTestId('vote-panel')).not.toBeInTheDocument();
    });
  });

  describe('Test 5: Vote result - Continue (AC-6, AC-10)', () => {
    test('shows vote result overlay on VoteResult Continue with breakdown', async () => {
      const { user } = renderWithProviders(
        <GameBoard initialState={gameStates.charlestonVoting} ws={mockWs} />
      );

      await voteAndAck(user, 'Continue');
      await sendPublicEvent({
        VoteResult: {
          result: 'Continue',
          votes: {
            East: 'Continue',
            South: 'Continue',
            West: 'Continue',
            North: 'Continue',
          },
        },
      });

      expect(screen.getByTestId('vote-result-overlay')).toBeInTheDocument();
      expect(screen.getByTestId('vote-result-title')).toHaveTextContent('Charleston CONTINUES');
      expect(screen.getByTestId('vote-breakdown-counts')).toHaveTextContent('0 Stop, 4 Continue');
      expect(screen.getByTestId('vote-result-message')).toHaveTextContent(
        'Second Charleston starting...'
      );
    });

    test('transitions to SecondLeft on CharlestonPhaseChanged after Continue', async () => {
      vi.useFakeTimers();
      try {
        renderWithProviders(<GameBoard initialState={gameStates.charlestonVoting} ws={mockWs} />);

        // Stage 3 tiles, then Proceed + immediate ack (workaround for fake timer compat)
        await act(async () => {
          screen.getByTestId('tile-3-3-0').click();
          screen.getByTestId('tile-6-6-0').click();
          screen.getByTestId('tile-9-9-0').click();
          screen.getByTestId('proceed-button').click();
        });
        await sendPublicEvent({ PlayerVoted: { player: 'South' } });
        await sendPublicEvent({ VoteResult: { result: 'Continue' } });

        // Auto-dismiss overlay after 3 seconds
        await act(async () => {
          vi.advanceTimersByTime(3000);
        });

        await sendPublicEvent({ CharlestonPhaseChanged: { stage: 'SecondLeft' } });

        expect(screen.getByTestId('charleston-direction')).toHaveTextContent(/left/i);
        expect(screen.queryByTestId('vote-panel')).not.toBeInTheDocument();
        expect(screen.queryByTestId('vote-result-overlay')).not.toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('Test 6: Bot voting message (AC-9)', () => {
    test('shows bot vote message when a bot PlayerVoted event arrives', async () => {
      const { user } = renderWithProviders(
        <GameBoard initialState={gameStates.charlestonVoting} ws={mockWs} />
      );

      await voteAndAck(user, 'Stop');

      // West is a bot in the fixture
      await sendPublicEvent({ PlayerVoted: { player: 'West' } });

      expect(screen.getByTestId('bot-vote-message')).toHaveTextContent('West (Bot) has voted');
    });

    test('does not show bot message for human player votes', async () => {
      const { user } = renderWithProviders(
        <GameBoard initialState={gameStates.charlestonVoting} ws={mockWs} />
      );

      await voteAndAck(user, 'Stop');

      // East is a human in the fixture
      await sendPublicEvent({ PlayerVoted: { player: 'East' } });

      expect(screen.queryByTestId('bot-vote-message')).not.toBeInTheDocument();
    });
  });

  describe('Test 7: Voting entered from FirstLeft phase change', () => {
    test('transitions from FirstLeft to VotingToContinue and shows vote panel', async () => {
      renderWithProviders(<GameBoard initialState={gameStates.charlestonFirstLeft} ws={mockWs} />);

      await sendPublicEvent({ CharlestonPhaseChanged: { stage: 'VotingToContinue' } });

      await waitFor(() => {
        expect(screen.getByTestId('vote-panel')).toBeInTheDocument();
      });

      expect(screen.getByTestId('proceed-button')).toBeInTheDocument();
    });
  });

  describe('Test 8: EC-6 Double-submit prevention', () => {
    test('only sends one VoteCharleston command on click', async () => {
      const { user } = renderWithProviders(
        <GameBoard initialState={gameStates.charlestonVoting} ws={mockWs} />
      );

      await voteAndAck(user, 'Stop');

      expect(screen.getByTestId('proceed-button')).toBeDisabled();

      // Only one VoteCharleston command should have been sent
      const sentMessages = mockWs.send.mock.calls.map((call: [string]) => JSON.parse(call[0]));
      const voteCommands = sentMessages.filter(
        (msg: { kind: string; payload: { command: GameCommand } }) =>
          msg.kind === 'Command' && 'VoteCharleston' in msg.payload.command
      );
      expect(voteCommands).toHaveLength(1);
    });
  });

  describe('Test 9: EC-7 Vote retry on missing ack', () => {
    test('retries vote command if no PlayerVoted ack within 5 seconds', async () => {
      vi.useFakeTimers();
      try {
        renderWithProviders(<GameBoard initialState={gameStates.charlestonVoting} ws={mockWs} />);

        // Use direct .click() to avoid userEvent fake-timer issues
        await act(async () => {
          screen.getByTestId('proceed-button').click();
        });

        expect(mockWs.send).toHaveBeenCalledTimes(1);

        // Wait 5 seconds - should trigger retry
        await act(async () => {
          vi.advanceTimersByTime(5000);
        });

        expect(mockWs.send).toHaveBeenCalledTimes(2);

        expect(screen.getByTestId('charleston-error-message')).toHaveTextContent(
          /failed to submit vote.*retrying/i
        );
      } finally {
        vi.useRealTimers();
      }
    });

    test('stops retrying after PlayerVoted ack received', async () => {
      vi.useFakeTimers();
      try {
        renderWithProviders(<GameBoard initialState={gameStates.charlestonVoting} ws={mockWs} />);

        await act(async () => {
          screen.getByTestId('proceed-button').click();
        });

        expect(mockWs.send).toHaveBeenCalledTimes(1);

        // Receive ack before retry timeout
        await act(async () => {
          vi.advanceTimersByTime(2000);
        });

        await sendPublicEvent({ PlayerVoted: { player: 'South' } });

        // Wait past the retry window
        await act(async () => {
          vi.advanceTimersByTime(5000);
        });

        // Should NOT have retried since ack was received
        expect(mockWs.send).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('Test 10: Full voting flow (Stop)', () => {
    test('complete stop vote flow: vote → acks → result → complete → playing', async () => {
      const { user } = renderWithProviders(
        <GameBoard initialState={gameStates.charlestonVoting} ws={mockWs} />
      );

      // 1. Vote panel visible
      expect(screen.getByTestId('vote-panel')).toBeInTheDocument();

      // 2. Click Stop + ack
      await voteAndAck(user, 'Stop');

      // 3. Remaining players vote
      await sendPublicEvent({ PlayerVoted: { player: 'East' } });
      await sendPublicEvent({ PlayerVoted: { player: 'West' } });
      await sendPublicEvent({ PlayerVoted: { player: 'North' } });

      // 4. VoteResult Stop
      await sendPublicEvent({
        VoteResult: {
          result: 'Stop',
          votes: {
            East: 'Stop',
            South: 'Stop',
            West: 'Stop',
            North: 'Stop',
          },
        },
      });

      // 5. Vote result overlay visible
      expect(screen.getByTestId('vote-result-overlay')).toBeInTheDocument();
      expect(screen.getByTestId('vote-result-title')).toHaveTextContent('Charleston STOPPED');
      expect(screen.getByTestId('vote-breakdown-counts')).toHaveTextContent('4 Stop, 0 Continue');

      // 6. CharlestonComplete + PhaseChanged
      await sendPublicEvent('CharlestonComplete');
      await sendPublicEvent({ PhaseChanged: { phase: 'Playing' } });

      // 7. Vote UI gone
      expect(screen.queryByTestId('vote-panel')).not.toBeInTheDocument();
    });
  });

  describe('Test 11: Full voting flow (Continue)', () => {
    test('complete continue vote flow: vote → acks → result → SecondLeft', async () => {
      vi.useFakeTimers();
      try {
        renderWithProviders(<GameBoard initialState={gameStates.charlestonVoting} ws={mockWs} />);

        // 1. Stage 3 tiles, then Proceed + ack
        await act(async () => {
          screen.getByTestId('tile-3-3-0').click();
          screen.getByTestId('tile-6-6-0').click();
          screen.getByTestId('tile-9-9-0').click();
          screen.getByTestId('proceed-button').click();
        });
        await sendPublicEvent({ PlayerVoted: { player: 'South' } });

        // 2. Remaining players vote
        await sendPublicEvent({ PlayerVoted: { player: 'East' } });
        await sendPublicEvent({ PlayerVoted: { player: 'West' } });
        await sendPublicEvent({ PlayerVoted: { player: 'North' } });

        // 3. VoteResult Continue (unanimous)
        await sendPublicEvent({
          VoteResult: {
            result: 'Continue',
            votes: {
              East: 'Continue',
              South: 'Continue',
              West: 'Continue',
              North: 'Continue',
            },
          },
        });

        // 4. Result overlay shows
        expect(screen.getByTestId('vote-result-overlay')).toBeInTheDocument();
        expect(screen.getByTestId('vote-result-title')).toHaveTextContent('Charleston CONTINUES');
        expect(screen.getByTestId('vote-breakdown-counts')).toHaveTextContent('0 Stop, 4 Continue');

        // 5. Auto-dismiss after 3 seconds
        await act(async () => {
          vi.advanceTimersByTime(3000);
        });

        // 6. Phase changes to SecondLeft
        await sendPublicEvent({ CharlestonPhaseChanged: { stage: 'SecondLeft' } });

        expect(screen.getByTestId('charleston-direction')).toHaveTextContent(/left/i);

        // 7. Vote UI gone
        expect(screen.queryByTestId('vote-panel')).not.toBeInTheDocument();
        expect(screen.queryByTestId('vote-result-overlay')).not.toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
