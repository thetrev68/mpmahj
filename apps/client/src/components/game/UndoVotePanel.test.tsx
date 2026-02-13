import { describe, expect, test, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { UndoVotePanel } from './UndoVotePanel';

const seats = ['East', 'South', 'West', 'North'] as const;

describe('UndoVotePanel', () => {
  test('renders request information', () => {
    renderWithProviders(
      <UndoVotePanel
        undoRequest={{ requester: 'East', target_move: 42 }}
        currentSeat="South"
        seats={[...seats]}
        votes={{ East: true, South: null, West: null, North: null }}
        onVote={vi.fn()}
        timeRemaining={30}
      />
    );

    expect(screen.getByTestId('undo-vote-panel')).toBeInTheDocument();
    expect(screen.getByTestId('undo-vote-summary')).toHaveTextContent('East requested undo');
  });

  test('sends approve vote', async () => {
    const onVote = vi.fn();
    const { user } = renderWithProviders(
      <UndoVotePanel
        undoRequest={{ requester: 'East', target_move: 42 }}
        currentSeat="South"
        seats={[...seats]}
        votes={{ East: true, South: null, West: null, North: null }}
        onVote={onVote}
        timeRemaining={20}
      />
    );

    await user.click(screen.getByTestId('undo-vote-approve'));
    expect(onVote).toHaveBeenCalledWith(true);
  });

  test('sends deny vote', async () => {
    const onVote = vi.fn();
    const { user } = renderWithProviders(
      <UndoVotePanel
        undoRequest={{ requester: 'East', target_move: 42 }}
        currentSeat="South"
        seats={[...seats]}
        votes={{ East: true, South: null, West: null, North: null }}
        onVote={onVote}
        timeRemaining={20}
      />
    );

    await user.click(screen.getByTestId('undo-vote-deny'));
    expect(onVote).toHaveBeenCalledWith(false);
  });

  test('hides vote buttons for requester', () => {
    renderWithProviders(
      <UndoVotePanel
        undoRequest={{ requester: 'South', target_move: 42 }}
        currentSeat="South"
        seats={[...seats]}
        votes={{ South: true }}
        onVote={vi.fn()}
        timeRemaining={15}
      />
    );

    expect(screen.queryByTestId('undo-vote-approve')).not.toBeInTheDocument();
    expect(screen.getByText(/Waiting for other players/i)).toBeInTheDocument();
  });
});
