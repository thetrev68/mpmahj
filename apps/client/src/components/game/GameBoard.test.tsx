import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
