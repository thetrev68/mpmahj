/**
 * CallWindowPanel Component Tests
 *
 * Related: US-011 (Call Window & Intent Buffering)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CallWindowPanel } from './CallWindowPanel';
import type { Tile } from '@/types/bindings/generated/Tile';
import type { Seat } from '@/types/bindings/generated/Seat';

const DOT_5 = 22 as Tile;
const EAST: Seat = 'East';

describe('CallWindowPanel', () => {
  const defaultProps = {
    callableTile: DOT_5,
    discardedBy: EAST,
    canCallForPung: true,
    canCallForKong: true,
    canCallForMahjong: true,
    onCallIntent: vi.fn(),
    onPass: vi.fn(),
    timerRemaining: 10,
    timerDuration: 10,
    disabled: false,
  };

  it('renders call window with all buttons', () => {
    render(<CallWindowPanel {...defaultProps} />);

    expect(screen.getByRole('dialog', { name: /call window/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /call for pung/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /call for kong/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /call for mahjong/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pass/i })).toBeInTheDocument();
  });

  it('displays the discarded tile information', () => {
    render(<CallWindowPanel {...defaultProps} />);

    expect(screen.getByText(/east discarded/i)).toBeInTheDocument();
    expect(screen.getByText(/5 dot/i)).toBeInTheDocument();
  });

  it('renders countdown timer', () => {
    render(<CallWindowPanel {...defaultProps} />);

    expect(screen.getByRole('timer')).toBeInTheDocument();
    expect(screen.getByText('10s')).toBeInTheDocument();
  });

  it('calls onCallIntent with Meld when Pung button clicked', async () => {
    const user = userEvent.setup();
    const onCallIntent = vi.fn();

    render(<CallWindowPanel {...defaultProps} onCallIntent={onCallIntent} />);

    const pungButton = screen.getByRole('button', { name: /call for pung/i });
    await user.click(pungButton);

    expect(onCallIntent).toHaveBeenCalledWith('Meld');
  });

  it('calls onCallIntent with Meld when Kong button clicked', async () => {
    const user = userEvent.setup();
    const onCallIntent = vi.fn();

    render(<CallWindowPanel {...defaultProps} onCallIntent={onCallIntent} />);

    const kongButton = screen.getByRole('button', { name: /call for kong/i });
    await user.click(kongButton);

    expect(onCallIntent).toHaveBeenCalledWith('Meld');
  });

  it('calls onCallIntent with Mahjong when Mahjong button clicked', async () => {
    const user = userEvent.setup();
    const onCallIntent = vi.fn();

    render(<CallWindowPanel {...defaultProps} onCallIntent={onCallIntent} />);

    const mahjongButton = screen.getByRole('button', { name: /call for mahjong/i });
    await user.click(mahjongButton);

    expect(onCallIntent).toHaveBeenCalledWith('Mahjong');
  });

  it('calls onPass when Pass button clicked', async () => {
    const user = userEvent.setup();
    const onPass = vi.fn();

    render(<CallWindowPanel {...defaultProps} onPass={onPass} />);

    const passButton = screen.getByRole('button', { name: /pass/i });
    await user.click(passButton);

    expect(onPass).toHaveBeenCalledTimes(1);
  });

  it('disables Pung button when canCallForPung is false', () => {
    render(<CallWindowPanel {...defaultProps} canCallForPung={false} />);

    const pungButton = screen.getByRole('button', { name: /call for pung/i });
    expect(pungButton).toBeDisabled();
  });

  it('disables Kong button when canCallForKong is false', () => {
    render(<CallWindowPanel {...defaultProps} canCallForKong={false} />);

    const kongButton = screen.getByRole('button', { name: /call for kong/i });
    expect(kongButton).toBeDisabled();
  });

  it('disables all buttons when disabled prop is true', () => {
    render(<CallWindowPanel {...defaultProps} disabled={true} />);

    expect(screen.getByRole('button', { name: /call for pung/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /call for kong/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /call for mahjong/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /pass/i })).toBeDisabled();
  });

  it('displays waiting message when disabled', () => {
    render(<CallWindowPanel {...defaultProps} disabled={true} />);

    expect(screen.getByText(/waiting for others/i)).toBeInTheDocument();
  });

  it('Mahjong button always enabled regardless of meld availability', () => {
    render(
      <CallWindowPanel
        {...defaultProps}
        canCallForPung={false}
        canCallForKong={false}
        disabled={false}
      />
    );

    // Mahjong should still be enabled even if melds are not possible
    const mahjongButton = screen.getByRole('button', { name: /call for mahjong/i });
    expect(mahjongButton).not.toBeDisabled();
  });
});
