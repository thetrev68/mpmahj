import { describe, expect, it } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { GameBoard } from './GameBoard';
import { createMockWebSocket } from '@/test/mocks/websocket';
import { fixtures } from '@/test/fixtures';

describe('GameBoard', () => {
  it('uses the table felt gradient token class on the root wrapper', () => {
    const mockWs = createMockWebSocket();

    render(<GameBoard initialState={fixtures.gameStates.playingDrawing} ws={mockWs} />);

    const root = screen.getByTestId('game-board');
    expect(root).toHaveClass('bg-[image:var(--table-felt-gradient)]');
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
});
