import { describe, expect, test, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { HintSettingsSection } from './HintSettingsSection';
import type { HintSettings } from '@/lib/hintSettings';

describe('HintSettingsSection', () => {
  const settings: HintSettings = {
    useHints: true,
    sortDiscards: false,
  };

  test('renders Use Hints and Sort Discard Pile switches and removes legacy controls', () => {
    renderWithProviders(<HintSettingsSection settings={settings} onChange={vi.fn()} />);

    const section = screen.getByTestId('hint-settings-section');
    expect(screen.getByLabelText('Use Hints')).toBeInTheDocument();
    expect(screen.getByTestId('use-hints-toggle')).toBeInTheDocument();
    expect(screen.getByLabelText('Sort Discard Pile')).toBeInTheDocument();
    expect(screen.getByTestId('sort-discards-toggle')).toBeInTheDocument();
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

  test('calls onChange with useHints false when the hints switch is toggled off', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <HintSettingsSection settings={settings} onChange={onChange} />
    );

    await user.click(screen.getByTestId('use-hints-toggle'));

    expect(onChange).toHaveBeenCalledWith({ useHints: false, sortDiscards: false });
  });

  test('calls onChange with useHints true when the hints switch is toggled on', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <HintSettingsSection
        settings={{ useHints: false, sortDiscards: false }}
        onChange={onChange}
      />
    );

    await user.click(screen.getByTestId('use-hints-toggle'));

    expect(onChange).toHaveBeenCalledWith({ useHints: true, sortDiscards: false });
  });

  test('calls onChange with sortDiscards true when the sort toggle is turned on', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <HintSettingsSection settings={settings} onChange={onChange} />
    );

    await user.click(screen.getByTestId('sort-discards-toggle'));

    expect(onChange).toHaveBeenCalledWith({ useHints: true, sortDiscards: true });
  });

  test('calls onChange with sortDiscards false when the sort toggle is turned off', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <HintSettingsSection settings={{ useHints: true, sortDiscards: true }} onChange={onChange} />
    );

    await user.click(screen.getByTestId('sort-discards-toggle'));

    expect(onChange).toHaveBeenCalledWith({ useHints: true, sortDiscards: false });
  });
});
