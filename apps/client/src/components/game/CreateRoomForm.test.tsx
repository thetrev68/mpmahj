import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateRoomForm } from './CreateRoomForm';

describe('CreateRoomForm', () => {
  it('shows timer settings panel in create room dialog', () => {
    render(<CreateRoomForm isOpen={true} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole('group', { name: /timer settings/i })).toBeInTheDocument();
  });

  it('submits existing CreateRoom payload shape', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<CreateRoomForm isOpen={true} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /^create$/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      room_name: 'My American Mahjong Game',
      card_year: 2025,
      fill_with_bots: false,
      bot_difficulty: null,
    });
  });
});
