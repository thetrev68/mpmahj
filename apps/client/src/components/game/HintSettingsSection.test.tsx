import { describe, expect, test, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { HintSettingsSection } from './HintSettingsSection';
import type { HintSettings } from '@/lib/hintSettings';

describe('HintSettingsSection', () => {
  const settings: HintSettings = {
    useHints: true,
  };

  test('renders only the Use Hints switch and removes legacy controls', () => {
    renderWithProviders(<HintSettingsSection settings={settings} onChange={vi.fn()} />);

    const section = screen.getByTestId('hint-settings-section');
    expect(screen.getByLabelText('Use Hints')).toBeInTheDocument();
    expect(screen.getByTestId('use-hints-toggle')).toBeInTheDocument();
    expect(screen.queryByTestId('hint-verbosity-select')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hint-preview-Beginner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hint-preview-Intermediate')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hint-preview-Expert')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hint-preview-Disabled')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hint-preview-output')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hint-sound-enabled')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hint-sound-type-select')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hint-sound-test-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hint-settings-reset-button')).not.toBeInTheDocument();
    expect(section.className).not.toMatch(/bg-slate-|text-slate-|border-slate-|bg-cyan-/);
  });

  test('calls onChange with false when the switch is toggled off', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <HintSettingsSection settings={settings} onChange={onChange} />
    );

    await user.click(screen.getByTestId('use-hints-toggle'));

    expect(onChange).toHaveBeenCalledWith({ useHints: false });
  });

  test('calls onChange with true when the switch is toggled on', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <HintSettingsSection settings={{ useHints: false }} onChange={onChange} />
    );

    await user.click(screen.getByTestId('use-hints-toggle'));

    expect(onChange).toHaveBeenCalledWith({ useHints: true });
  });
});
