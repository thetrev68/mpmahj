import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { HistoryPanel } from './HistoryPanel';
import type { UseHistoryDataResult } from '@/hooks/useHistoryData';

function createHistoryState(overrides: Partial<UseHistoryDataResult> = {}): UseHistoryDataResult {
  return {
    moves: [
      {
        move_number: 24,
        timestamp: '2026-02-10T12:00:00Z',
        seat: 'South',
        action: { DrawTile: { tile: 18, visible: false } },
        description: 'Drew tile from wall',
      },
      {
        move_number: 25,
        timestamp: '2026-02-10T12:01:00Z',
        seat: 'South',
        action: { DiscardTile: { tile: 24 } },
        description: 'Discarded 7 Dot',
      },
    ],
    filteredMoves: [
      {
        move_number: 25,
        timestamp: '2026-02-10T12:01:00Z',
        seat: 'South',
        action: { DiscardTile: { tile: 24 } },
        description: 'Discarded 7 Dot',
      },
      {
        move_number: 24,
        timestamp: '2026-02-10T12:00:00Z',
        seat: 'South',
        action: { DrawTile: { tile: 18, visible: false } },
        description: 'Drew tile from wall',
      },
    ],
    isLoading: false,
    error: null,
    playerFilter: 'All',
    actionFilters: new Set(),
    searchQuery: '',
    expandedMoves: new Set(),
    pulsingMoveNumber: null,
    requestCount: 1,
    setPlayerFilter: vi.fn(),
    toggleActionFilter: vi.fn(),
    setSearchQuery: vi.fn(),
    toggleExpandedMove: vi.fn(),
    exportHistory: vi.fn(),
    clearError: vi.fn(),
    ...overrides,
  };
}

describe('HistoryPanel', () => {
  it('renders history entries with key fields', () => {
    const history = createHistoryState();

    renderWithProviders(
      <HistoryPanel isOpen={true} roomId="AB12C" onClose={vi.fn()} history={history} />
    );

    expect(screen.getByRole('dialog', { name: /game move history/i })).toBeInTheDocument();
    expect(screen.getByText('#25 South')).toBeInTheDocument();
    expect(screen.getByText('Discarded 7 Dot')).toBeInTheDocument();
    expect(screen.queryByText('Call Window Closed')).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    const history = createHistoryState();
    const { user } = renderWithProviders(
      <HistoryPanel isOpen={true} roomId="AB12C" onClose={onClose} history={history} />
    );

    await user.click(screen.getByRole('button', { name: /close history panel/i }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows empty state for no moves', () => {
    const history = createHistoryState({ moves: [], filteredMoves: [] });

    renderWithProviders(
      <HistoryPanel isOpen={true} roomId="AB12C" onClose={vi.fn()} history={history} />
    );

    expect(screen.getByText(/No moves yet\. History will appear here\./i)).toBeInTheDocument();
  });

  it('highlights search matches in descriptions', () => {
    const history = createHistoryState({
      searchQuery: '7 Dot',
    });

    renderWithProviders(
      <HistoryPanel isOpen={true} roomId="AB12C" onClose={vi.fn()} history={history} />
    );

    expect(screen.getByText('7 Dot')).toBeInTheDocument();
    expect(screen.getByText('7 Dot').tagName.toLowerCase()).toBe('mark');
  });

  it('invokes export buttons', async () => {
    const history = createHistoryState();
    const { user } = renderWithProviders(
      <HistoryPanel isOpen={true} roomId="AB12C" onClose={vi.fn()} history={history} />
    );

    await user.click(screen.getByTestId('history-export-json'));
    await user.click(screen.getByTestId('history-export-csv'));
    await user.click(screen.getByTestId('history-export-txt'));

    expect(history.exportHistory).toHaveBeenCalledWith('json', 'AB12C');
    expect(history.exportHistory).toHaveBeenCalledWith('csv', 'AB12C');
    expect(history.exportHistory).toHaveBeenCalledWith('txt', 'AB12C');
  });

  it('shows move-specific jump button text when expanded', async () => {
    const history = createHistoryState({
      expandedMoves: new Set([25]),
    });
    const { user } = renderWithProviders(
      <HistoryPanel
        isOpen={true}
        roomId="AB12C"
        onClose={vi.fn()}
        history={history}
        onJumpToMove={vi.fn()}
      />
    );

    const jumpButton = screen.getByText(/Jump to Move #25/i, { selector: 'button' });
    expect(jumpButton).toBeInTheDocument();
    await user.click(jumpButton);
  });
});
