/**
 * VotePanel Component Tests
 *
 * Related: US-004 (Charleston First Left), AC-12
 */

import { describe, expect, test, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { VotePanel } from './VotePanel';

describe('VotePanel', () => {
  test('renders voting buttons', () => {
    renderWithProviders(<VotePanel onVote={vi.fn()} />);

    expect(screen.getByTestId('vote-panel')).toBeInTheDocument();
    expect(screen.getByTestId('vote-stop-button')).toBeInTheDocument();
    expect(screen.getByTestId('vote-continue-button')).toBeInTheDocument();
  });

  test('calls onVote with Stop', async () => {
    const onVote = vi.fn();
    const { user } = renderWithProviders(<VotePanel onVote={onVote} />);

    await user.click(screen.getByTestId('vote-stop-button'));
    expect(onVote).toHaveBeenCalledWith('Stop');
  });

  test('calls onVote with Continue', async () => {
    const onVote = vi.fn();
    const { user } = renderWithProviders(<VotePanel onVote={onVote} />);

    await user.click(screen.getByTestId('vote-continue-button'));
    expect(onVote).toHaveBeenCalledWith('Continue');
  });

  test('disables buttons and shows waiting message when disabled', () => {
    renderWithProviders(<VotePanel onVote={vi.fn()} disabled={true} />);

    expect(screen.getByTestId('vote-stop-button')).toBeDisabled();
    expect(screen.getByTestId('vote-continue-button')).toBeDisabled();
    expect(screen.getByText(/Vote submitted/i)).toBeInTheDocument();
  });
});
