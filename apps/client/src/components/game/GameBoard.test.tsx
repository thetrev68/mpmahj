import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen, within } from '@/test/test-utils';
import { GameBoard } from './GameBoard';
import { createMockWebSocket } from '@/test/mocks/websocket';
import { fixtures } from '@/test/fixtures';
import { useGameUIStore } from '@/stores/gameUIStore';

describe('GameBoard', () => {
  beforeEach(() => {
    useGameUIStore.getState().reset();
  });

  afterEach(() => {
    useGameUIStore.getState().reset();
  });
  it('uses the table felt gradient token class on the root wrapper', () => {
    const mockWs = createMockWebSocket();

    render(<GameBoard initialState={fixtures.gameStates.playingDrawing} ws={mockWs} />);

    const root = screen.getByTestId('game-board');
    expect(root).toHaveClass('bg-[image:var(--table-felt-gradient)]');
    expect(root).not.toHaveClass('dark');
    expect(root).not.toHaveClass('bg-gradient-to-br');
  });

  it('renders board controls strip with leave and logout buttons only', () => {
    const mockWs = createMockWebSocket();

    render(<GameBoard initialState={fixtures.gameStates.playingDrawing} ws={mockWs} />);

    expect(screen.getByTestId('top-chrome-stack')).toHaveClass(
      'absolute',
      'inset-x-0',
      'top-0',
      'flex',
      'flex-col'
    );
    expect(screen.getByTestId('board-controls-row')).toHaveClass(
      'pointer-events-none',
      'justify-end'
    );
    expect(screen.getByTestId('board-controls-strip')).toBeInTheDocument();
    expect(screen.getByTestId('board-controls-strip')).toHaveClass(
      'pointer-events-auto',
      'flex-wrap',
      'justify-end'
    );
    expect(screen.queryByTestId('board-settings-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('start-over-button')).not.toBeInTheDocument();
    expect(screen.getByTestId('leave-game-button')).toBeInTheDocument();
    expect(screen.getByTestId('logout-button')).toBeInTheDocument();
    expect(screen.getByTestId('leave-game-button')).toHaveClass(
      'bg-background/80',
      'text-red-700',
      'dark:text-red-200'
    );
    expect(screen.getByTestId('leave-game-button')).not.toHaveClass(
      'text-red-200',
      'hover:bg-red-900/60'
    );
    expect(screen.getByTestId('logout-button')).toHaveClass('bg-background/80', 'text-foreground');
    expect(screen.getByTestId('logout-button')).not.toHaveClass(
      'text-slate-100',
      'hover:bg-slate-800/70'
    );
  });

  it('does not render the removed sound settings placeholder', () => {
    const mockWs = createMockWebSocket();

    render(<GameBoard initialState={fixtures.gameStates.playingDrawing} ws={mockWs} />);

    expect(screen.queryByTestId('sound-settings-placeholder')).not.toBeInTheDocument();
  });

  it('preserves top padding so the fixed playing status bar does not obscure content', () => {
    const mockWs = createMockWebSocket();

    render(<GameBoard initialState={fixtures.gameStates.playingDrawing} ws={mockWs} />);

    expect(screen.getByTestId('game-board-layout')).toHaveClass('pt-4');
  });

  it('renders the interactive right rail layout contract', () => {
    const mockWs = createMockWebSocket();

    render(<GameBoard initialState={fixtures.gameStates.playingDrawing} ws={mockWs} />);

    expect(screen.getByTestId('right-rail')).toHaveClass(
      'right-rail',
      'hidden',
      'lg:flex',
      'lg:w-[var(--right-rail-w)]',
      'lg:min-w-[var(--right-rail-w)]',
      'lg:flex-none',
      'lg:flex-col',
      'lg:rounded-l-2xl',
      'lg:border-l',
      'lg:bg-card',
      'dark:lg:bg-slate-950'
    );
    expect(screen.getByTestId('right-rail')).not.toHaveClass(
      'lg:w-[18rem]',
      'lg:bg-slate-800',
      'lg:backdrop-blur-md'
    );
    expect(screen.getByTestId('right-rail')).not.toHaveAttribute('aria-hidden');
    expect(screen.queryByTestId('right-rail-top')).not.toBeInTheDocument();
    expect(screen.getByTestId('right-rail-bottom')).toBeInTheDocument();
    expect(screen.getByTestId('right-rail-bottom')).toHaveClass(
      'min-h-0',
      'bg-card',
      'dark:bg-slate-900'
    );
    expect(screen.getByTestId('right-rail-bottom')).not.toHaveClass(
      'border-t',
      'bg-muted/35',
      'bg-background/35',
      'dark:bg-muted/50'
    );
    expect(screen.getByTestId('right-rail-bottom')).not.toHaveAttribute('data-hint-expanded');
    expect(screen.getByTestId('game-board-layout')).toHaveClass('lg:pr-4');
    expect(screen.getByTestId('game-board-layout')).not.toHaveClass('lg:justify-end');
    expect(screen.getByTestId('board-layout-shell')).toHaveClass('lg:items-stretch');
    expect(screen.getByTestId('board-layout-shell')).not.toHaveClass('lg:justify-end');
    expect(screen.getByTestId('square-board-container')).toHaveClass(
      'lg:w-[min(var(--board-max-w),calc(100vh-var(--board-top-offset)),calc(100vw-var(--board-right-reserve)))]',
      'lg:flex-none'
    );
    expect(screen.getByTestId('square-board-container')).toHaveClass('lg:aspect-square');
  });

  it('renders a shared top chrome status stack with Charleston slot and wall counter slot', () => {
    const mockWs = createMockWebSocket();

    render(<GameBoard initialState={fixtures.gameStates.charlestonFirstRight} ws={mockWs} />);

    expect(screen.getByTestId('charleston-board-cap')).toBeInTheDocument();
    expect(screen.getByTestId('charleston-board-cap')).toHaveClass(
      'absolute',
      'inset-x-0',
      'top-0'
    );
    expect(screen.getByTestId('top-chrome-status-stack')).toBeInTheDocument();
    expect(screen.getByTestId('charleston-top-chrome-slot')).toBeInTheDocument();
    expect(screen.getByTestId('wall-counter')).toBeInTheDocument();
    expect(screen.getByTestId('top-chrome-stack')).toHaveClass('z-20');
    expect(screen.getByTestId('top-chrome-stack')).toHaveAttribute('data-board-layer', 'z-20');
    expect(
      within(screen.getByTestId('charleston-top-chrome-slot')).getByTestId('charleston-tracker')
    ).toBeInTheDocument();
    expect(screen.getByTestId('square-board-container')).toContainElement(
      screen.getByTestId('charleston-top-chrome-slot')
    );
  });

  it('renders the call-window prompt only once at board level', () => {
    const mockWs = createMockWebSocket();

    render(<GameBoard initialState={fixtures.gameStates.playingCallWindow} ws={mockWs} />);

    expect(screen.getByText('Call window open — Call or Pass')).toBeInTheDocument();
    expect(screen.getByTestId('action-instruction')).toHaveTextContent(
      'Press Proceed to pass, or add matching tiles to claim.'
    );
    expect(
      screen.queryByText('Call window open — Select claim tiles or press Proceed')
    ).not.toBeInTheDocument();
  });

  it('renders Charleston voting without duplicate vote submessages in the action area', () => {
    const mockWs = createMockWebSocket();

    render(<GameBoard initialState={fixtures.gameStates.charlestonVoting} ws={mockWs} />);

    expect(screen.getByTestId('charleston-tracker')).toHaveAttribute(
      'aria-label',
      'Charleston: Vote: Stop or Continue?'
    );
    expect(screen.getByTestId('action-instruction')).toHaveTextContent(
      'Round vote. Stage up to 3 tiles to continue. Stage 0 tiles to stop. Press Proceed when ready.'
    );
    expect(screen.queryByTestId('vote-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('vote-status-message')).not.toBeInTheDocument();
  });

  it('renders a single Charleston top status surface and keeps the gameplay status bar out of Charleston', () => {
    const mockWs = createMockWebSocket();

    render(<GameBoard initialState={fixtures.gameStates.charlestonFirstRight} ws={mockWs} />);

    expect(screen.getByTestId('charleston-tracker')).toBeInTheDocument();
    expect(screen.queryByTestId('gameplay-status-bar')).not.toBeInTheDocument();
  });

  it('preserves the gameplay status bar during playing phase', () => {
    const mockWs = createMockWebSocket();

    render(<GameBoard initialState={fixtures.gameStates.playingDrawing} ws={mockWs} />);

    expect(screen.getByTestId('gameplay-status-bar')).toBeInTheDocument();
    expect(screen.queryByTestId('charleston-tracker')).not.toBeInTheDocument();
  });

  it('heavenly hand overlay uses theme tokens, not hardcoded dark palette', async () => {
    act(() => {
      useGameUIStore.getState().dispatch({
        type: 'SET_HEAVENLY_HAND',
        pattern: 'All Flowers',
        base_score: 400,
      });
    });
    const mockWs = createMockWebSocket();

    let rendered: ReturnType<typeof render> | null = null;
    await act(async () => {
      rendered = render(
        <GameBoard initialState={fixtures.gameStates.playingDrawing} ws={mockWs} />
      );
    });

    const overlay = screen.getByTestId('heavenly-hand-overlay');
    expect(overlay).toHaveClass('bg-card');
    expect(overlay).not.toHaveClass('bg-gray-900');
    expect(screen.getByText('East wins with the initial deal!')).toHaveClass(
      'text-muted-foreground'
    );
    const scoreBox = screen.getByTestId('heavenly-hand-score-box');
    expect(scoreBox).toHaveClass('bg-muted');
    expect(scoreBox).not.toHaveClass('bg-gray-800');
    expect(screen.getByText('All Flowers')).toHaveClass('text-green-600', 'dark:text-green-300');
    expect(screen.getByText('400 points')).toHaveClass('text-yellow-600', 'dark:text-yellow-300');

    await act(async () => {
      rendered?.unmount();
    });
  });
});
