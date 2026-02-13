import { describe, expect, test, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { UndoButton } from './UndoButton';

describe('UndoButton', () => {
  test('renders remaining count in label', () => {
    renderWithProviders(
      <UndoButton available={true} remaining={3} max={10} recentActions={[]} onUndo={vi.fn()} />
    );

    expect(screen.getByTestId('undo-button')).toHaveTextContent('Undo (3 available)');
  });

  test('calls onUndo when clicked', async () => {
    const onUndo = vi.fn();
    const { user } = renderWithProviders(
      <UndoButton available={true} remaining={2} max={10} recentActions={[]} onUndo={onUndo} />
    );

    await user.click(screen.getByTestId('undo-button'));
    expect(onUndo).toHaveBeenCalledOnce();
  });

  test('disables when unavailable', () => {
    renderWithProviders(
      <UndoButton available={false} remaining={0} max={10} recentActions={[]} onUndo={vi.fn()} />
    );

    expect(screen.getByTestId('undo-button')).toBeDisabled();
  });

  test('shows loading state', () => {
    renderWithProviders(
      <UndoButton
        available={true}
        remaining={1}
        max={10}
        isLoading={true}
        recentActions={[]}
        onUndo={vi.fn()}
      />
    );

    expect(screen.getByTestId('undo-button')).toHaveTextContent(/Undoing/i);
  });
});
