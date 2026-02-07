/**
 * VotingPanel Component Tests
 *
 * Tests for US-005 Charleston Voting Panel
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VotingPanel } from './VotingPanel';

describe('VotingPanel', () => {
  describe('AC-1: Initial render', () => {
    it('displays Stop Charleston button', () => {
      render(<VotingPanel onVote={vi.fn()} disabled={false} />);

      expect(screen.getByRole('button', { name: /stop charleston/i })).toBeInTheDocument();
    });

    it('displays Continue Charleston button', () => {
      render(<VotingPanel onVote={vi.fn()} disabled={false} />);

      expect(screen.getByRole('button', { name: /continue charleston/i })).toBeInTheDocument();
    });

    it('displays instruction message', () => {
      render(<VotingPanel onVote={vi.fn()} disabled={false} />);

      expect(screen.getByText(/vote now/i)).toBeInTheDocument();
      expect(screen.getByText(/any stop vote ends charleston/i)).toBeInTheDocument();
    });
  });

  describe('AC-2: Vote submission (Stop)', () => {
    it('calls onVote with "Stop" when Stop button clicked', async () => {
      const user = userEvent.setup();
      const onVote = vi.fn();

      render(<VotingPanel onVote={onVote} disabled={false} />);

      await user.click(screen.getByRole('button', { name: /stop charleston/i }));

      expect(onVote).toHaveBeenCalledTimes(1);
      expect(onVote).toHaveBeenCalledWith('Stop');
    });

    it('disables both buttons after Stop is clicked', async () => {
      const user = userEvent.setup();
      const onVote = vi.fn();

      render(<VotingPanel onVote={onVote} disabled={false} />);

      await user.click(screen.getByRole('button', { name: /stop charleston/i }));

      expect(screen.getByRole('button', { name: /stop charleston/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /continue charleston/i })).toBeDisabled();
    });

    it('shows loading spinner on Stop button after click', async () => {
      const user = userEvent.setup();
      const onVote = vi.fn();

      render(<VotingPanel onVote={onVote} disabled={false} />);

      await user.click(screen.getByRole('button', { name: /stop charleston/i }));

      expect(screen.getByTestId('vote-loading-spinner')).toBeInTheDocument();
    });
  });

  describe('AC-3: Vote submission (Continue)', () => {
    it('calls onVote with "Continue" when Continue button clicked', async () => {
      const user = userEvent.setup();
      const onVote = vi.fn();

      render(<VotingPanel onVote={onVote} disabled={false} />);

      await user.click(screen.getByRole('button', { name: /continue charleston/i }));

      expect(onVote).toHaveBeenCalledTimes(1);
      expect(onVote).toHaveBeenCalledWith('Continue');
    });

    it('disables both buttons after Continue is clicked', async () => {
      const user = userEvent.setup();
      const onVote = vi.fn();

      render(<VotingPanel onVote={onVote} disabled={false} />);

      await user.click(screen.getByRole('button', { name: /continue charleston/i }));

      expect(screen.getByRole('button', { name: /stop charleston/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /continue charleston/i })).toBeDisabled();
    });

    it('shows loading spinner on Continue button after click', async () => {
      const user = userEvent.setup();
      const onVote = vi.fn();

      render(<VotingPanel onVote={onVote} disabled={false} />);

      await user.click(screen.getByRole('button', { name: /continue charleston/i }));

      expect(screen.getByTestId('vote-loading-spinner')).toBeInTheDocument();
    });
  });

  describe('AC-4: Vote progress tracking', () => {
    it('displays vote count when provided', () => {
      render(<VotingPanel onVote={vi.fn()} disabled={false} voteCount={3} totalPlayers={4} />);

      expect(screen.getByText(/3\/4 players voted/i)).toBeInTheDocument();
    });

    it('displays waiting message when hasVoted is true', () => {
      render(<VotingPanel onVote={vi.fn()} disabled={true} hasVoted={true} myVote="Stop" />);

      expect(screen.getByText(/you voted to stop/i)).toBeInTheDocument();
      expect(screen.getByText(/waiting for other players/i)).toBeInTheDocument();
    });

    it('displays Continue message when user voted Continue', () => {
      render(<VotingPanel onVote={vi.fn()} disabled={true} hasVoted={true} myVote="Continue" />);

      expect(screen.getByText(/you voted to continue/i)).toBeInTheDocument();
    });

    it('shows per-player vote indicators with checkmarks for voted players', () => {
      render(
        <VotingPanel
          onVote={vi.fn()}
          disabled={true}
          hasVoted={true}
          myVote="Stop"
          votedPlayers={['East', 'South']}
          allPlayers={[
            { seat: 'East', is_bot: false },
            { seat: 'South', is_bot: false },
            { seat: 'West', is_bot: true },
            { seat: 'North', is_bot: true },
          ]}
        />
      );

      expect(screen.getByTestId('vote-indicators')).toBeInTheDocument();
      expect(screen.getByTestId('vote-indicator-east')).toHaveTextContent('✓');
      expect(screen.getByTestId('vote-indicator-south')).toHaveTextContent('✓');
      expect(screen.getByTestId('vote-indicator-west')).toHaveTextContent('•');
      expect(screen.getByTestId('vote-indicator-north')).toHaveTextContent('•');
    });

    it('shows "Waiting for [PlayerName]..." message after voting', () => {
      render(
        <VotingPanel
          onVote={vi.fn()}
          disabled={true}
          hasVoted={true}
          myVote="Stop"
          votedPlayers={['East', 'South', 'West']}
          allPlayers={[
            { seat: 'East', is_bot: false },
            { seat: 'South', is_bot: false },
            { seat: 'West', is_bot: true },
            { seat: 'North', is_bot: true },
          ]}
        />
      );

      expect(screen.getByTestId('vote-waiting-message')).toHaveTextContent('Waiting for North...');
    });
  });

  describe('AC-9: Bot vote message', () => {
    it('displays bot vote message when provided', () => {
      render(
        <VotingPanel
          onVote={vi.fn()}
          disabled={true}
          hasVoted={true}
          myVote="Stop"
          botVoteMessage="West (Bot) has voted"
        />
      );

      expect(screen.getByTestId('bot-vote-message')).toHaveTextContent('West (Bot) has voted');
    });
  });

  describe('EC-6: Double-submit prevention', () => {
    it('prevents multiple calls when disabled prop is true', async () => {
      const user = userEvent.setup();
      const onVote = vi.fn();

      render(<VotingPanel onVote={onVote} disabled={true} />);

      const stopButton = screen.getByRole('button', { name: /stop charleston/i });
      expect(stopButton).toBeDisabled();

      // Try to click disabled button
      await user.click(stopButton);

      expect(onVote).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels on vote buttons', () => {
      render(<VotingPanel onVote={vi.fn()} disabled={false} />);

      const stopButton = screen.getByRole('button', { name: /stop charleston/i });
      const continueButton = screen.getByRole('button', { name: /continue charleston/i });

      expect(stopButton).toHaveAccessibleName();
      expect(continueButton).toHaveAccessibleName();
    });

    it('supports keyboard navigation with Tab', () => {
      render(<VotingPanel onVote={vi.fn()} disabled={false} />);

      const stopButton = screen.getByRole('button', { name: /stop charleston/i });
      const continueButton = screen.getByRole('button', { name: /continue charleston/i });

      // Both buttons should be focusable (tabIndex not -1)
      expect(stopButton).not.toHaveAttribute('tabIndex', '-1');
      expect(continueButton).not.toHaveAttribute('tabIndex', '-1');
    });
  });
});
