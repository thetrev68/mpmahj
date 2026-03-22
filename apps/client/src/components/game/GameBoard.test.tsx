import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@/test/test-utils';
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

    expect(screen.getByTestId('board-controls-strip')).toBeInTheDocument();
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

    expect(screen.getByTestId('game-board-layout')).toHaveClass('pt-16');
  });

  it('renders the interactive right rail layout contract', () => {
    const mockWs = createMockWebSocket();

    render(<GameBoard initialState={fixtures.gameStates.playingDrawing} ws={mockWs} />);

    expect(screen.getByTestId('right-rail')).toHaveClass(
      'right-rail',
      'hidden',
      'lg:flex',
      'lg:min-w-[24rem]',
      'lg:flex-1',
      'lg:flex-col',
      'lg:rounded-l-2xl',
      'lg:border-l',
      'lg:bg-card/92'
    );
    expect(screen.getByTestId('right-rail')).not.toHaveClass('lg:w-[18rem]', 'lg:bg-slate-800');
    expect(screen.getByTestId('right-rail')).not.toHaveAttribute('aria-hidden');
    expect(screen.getByTestId('right-rail-top')).toBeInTheDocument();
    expect(screen.getByTestId('right-rail-top')).toHaveClass('bg-muted/20');
    expect(screen.getByTestId('right-rail-bottom')).toBeInTheDocument();
    expect(screen.getByTestId('right-rail-bottom')).toHaveClass(
      'border-t',
      'border-border/60',
      'bg-background/35',
      'dark:bg-muted/50'
    );
    expect(screen.getByTestId('right-rail-bottom')).not.toHaveClass('border-slate-600');
    expect(screen.getByTestId('right-rail-bottom')).not.toHaveAttribute('data-hint-expanded');
    expect(screen.getByTestId('game-board-layout')).toHaveClass('lg:pr-0');
    expect(screen.getByTestId('game-board-layout')).not.toHaveClass('lg:justify-end');
    expect(screen.getByTestId('board-layout-shell')).toHaveClass('lg:items-stretch');
    expect(screen.getByTestId('board-layout-shell')).not.toHaveClass('lg:justify-end');
    expect(screen.getByTestId('square-board-container')).toHaveClass(
      'lg:w-[min(1200px,calc(100vh-5rem),calc(100vw-25rem))]',
      'lg:flex-none'
    );
    expect(screen.getByTestId('square-board-container')).toHaveClass('lg:aspect-square');
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

    expect(screen.getByTestId('gameplay-status-bar')).toHaveTextContent(
      'Charleston vote — Continue or stop'
    );
    expect(screen.getByTestId('action-instruction')).toHaveTextContent(
      'Round vote. Stage up to 3 tiles to continue. Stage 0 tiles to stop. Press Proceed when ready.'
    );
    expect(screen.queryByTestId('vote-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('vote-status-message')).not.toBeInTheDocument();
  });

  it('heavenly hand overlay uses theme tokens, not hardcoded dark palette', () => {
    useGameUIStore.getState().dispatch({
      type: 'SET_HEAVENLY_HAND',
      pattern: 'All Flowers',
      base_score: 400,
    });
    const mockWs = createMockWebSocket();

    render(<GameBoard initialState={fixtures.gameStates.playingDrawing} ws={mockWs} />);

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
  });
});
