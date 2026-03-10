import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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
    expect(root).not.toHaveClass('from-green-800');
    expect(root).not.toHaveClass('to-green-900');
  });

  it('does not set an inline background gradient style on the root wrapper', () => {
    const mockWs = createMockWebSocket();

    render(<GameBoard initialState={fixtures.gameStates.playingDrawing} ws={mockWs} />);

    const root = screen.getByTestId('game-board');
    expect(root.style.backgroundImage).toBe('');
    expect(root.style.background).toBe('');
  });

  it('does not render north/south/east/west wall containers', () => {
    const mockWs = createMockWebSocket();

    render(<GameBoard initialState={fixtures.gameStates.playingDrawing} ws={mockWs} />);

    expect(screen.queryByTestId('wall-north')).not.toBeInTheDocument();
    expect(screen.queryByTestId('wall-south')).not.toBeInTheDocument();
    expect(screen.queryByTestId('wall-east')).not.toBeInTheDocument();
    expect(screen.queryByTestId('wall-west')).not.toBeInTheDocument();
  });

  it('retains wall counter after wall visual removal', () => {
    const mockWs = createMockWebSocket();

    render(<GameBoard initialState={fixtures.gameStates.playingDrawing} ws={mockWs} />);

    expect(screen.getByTestId('wall-counter')).toBeInTheDocument();
  });

  it('renders board controls strip with settings and leave buttons in top-right', () => {
    const mockWs = createMockWebSocket();

    render(<GameBoard initialState={fixtures.gameStates.playingDrawing} ws={mockWs} />);

    expect(screen.getByTestId('board-controls-strip')).toBeInTheDocument();
    expect(screen.getByTestId('board-settings-button')).toBeInTheDocument();
    expect(screen.getByTestId('leave-game-button')).toBeInTheDocument();
  });

  it('toggles the sound settings placeholder from the gear button', () => {
    const mockWs = createMockWebSocket();

    render(<GameBoard initialState={fixtures.gameStates.playingDrawing} ws={mockWs} />);

    expect(screen.queryByTestId('sound-settings-placeholder')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('board-settings-button'));

    expect(screen.getByTestId('sound-settings-placeholder')).toHaveTextContent(
      'Sound settings coming soon'
    );
    expect(screen.getByTestId('sound-settings-placeholder')).toHaveTextContent('Auto-sort hand');
    expect(screen.queryByText(/Table rules/i)).not.toBeInTheDocument();
  });

  it('renders a square board container and a non-overlapping right rail reservation', () => {
    const mockWs = createMockWebSocket();

    render(<GameBoard initialState={fixtures.gameStates.playingDrawing} ws={mockWs} />);

    const boardLayout = screen.getByTestId('game-board-layout');
    const squareBoard = screen.getByTestId('square-board-container');
    const rightRail = screen.getByTestId('right-rail');

    expect(boardLayout).toBeInTheDocument();
    expect(squareBoard).toHaveClass('lg:aspect-square');
    expect(rightRail).toHaveClass('w-64', 'flex-shrink-0');
    expect(boardLayout).toContainElement(squareBoard);
    expect(boardLayout).toContainElement(rightRail);
  });

  it('left-anchors the desktop board layout while preserving the right rail', () => {
    const mockWs = createMockWebSocket();

    render(<GameBoard initialState={fixtures.gameStates.playingDrawing} ws={mockWs} />);

    const boardLayout = screen.getByTestId('game-board-layout');

    expect(boardLayout).toHaveClass('lg:justify-start');
    expect(boardLayout).not.toHaveClass('lg:justify-center');
    expect(boardLayout).not.toHaveClass('mx-auto');
    expect(boardLayout).not.toHaveClass('max-w-[1680px]');
    expect(screen.getByTestId('right-rail')).toBeInTheDocument();
  });

  it('does not include wall markup at desktop and mobile viewport widths', () => {
    const mockWs = createMockWebSocket();
    const originalInnerWidth = window.innerWidth;

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
    const { rerender } = render(
      <GameBoard initialState={fixtures.gameStates.playingDrawing} ws={mockWs} />
    );
    const desktopRoot = screen.getByTestId('game-board');
    expect(desktopRoot.innerHTML).not.toContain('wall-stack');
    expect(desktopRoot.innerHTML).not.toContain('wall-break-indicator');
    expect(desktopRoot.innerHTML).not.toContain('data-testid="wall-north"');
    expect(desktopRoot.innerHTML).not.toContain('data-testid="wall-south"');
    expect(desktopRoot.innerHTML).not.toContain('data-testid="wall-east"');
    expect(desktopRoot.innerHTML).not.toContain('data-testid="wall-west"');

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 });
    window.dispatchEvent(new Event('resize'));
    rerender(<GameBoard initialState={fixtures.gameStates.playingDrawing} ws={mockWs} />);
    const mobileRoot = screen.getByTestId('game-board');
    expect(mobileRoot.innerHTML).not.toContain('wall-stack');
    expect(mobileRoot.innerHTML).not.toContain('wall-break-indicator');
    expect(mobileRoot.innerHTML).not.toContain('data-testid="wall-north"');
    expect(mobileRoot.innerHTML).not.toContain('data-testid="wall-south"');
    expect(mobileRoot.innerHTML).not.toContain('data-testid="wall-east"');
    expect(mobileRoot.innerHTML).not.toContain('data-testid="wall-west"');

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
  });
});
