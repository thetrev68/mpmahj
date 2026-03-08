import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateRoomForm } from './CreateRoomForm';

describe('CreateRoomForm', () => {
  it('renders create room dialog controls', () => {
    render(<CreateRoomForm isOpen={true} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: /create room/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /room name/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /card year/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /allow blank exchange/i })).toBeInTheDocument();
  });

  it('submits existing CreateRoom payload shape', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<CreateRoomForm isOpen={true} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /^create$/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      room_name: 'My American Mahjong Game',
      card_year: 2025,
      house_rules: {
        ruleset: {
          card_year: 2025,
          timer_mode: 'Visible',
          blank_exchange_enabled: false,
          call_window_seconds: 10,
          charleston_timer_seconds: 60,
        },
        analysis_enabled: true,
      },
      fill_with_bots: false,
      bot_difficulty: null,
    });
  });
});
