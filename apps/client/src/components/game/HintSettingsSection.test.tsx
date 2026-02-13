import { describe, expect, test, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { HintSettingsSection } from './HintSettingsSection';
import type { HintSettings } from '@/lib/hintSettings';

describe('HintSettingsSection', () => {
  const settings: HintSettings = {
    verbosity: 'Beginner',
    sound_enabled: true,
    sound_type: 'Chime',
  };

  test('shows verbosity preview output when preview button is clicked', async () => {
    const { user } = renderWithProviders(
      <HintSettingsSection
        settings={settings}
        onChange={vi.fn()}
        onReset={vi.fn()}
        onTestSound={vi.fn()}
      />
    );

    await user.click(screen.getByTestId('hint-preview-Expert'));
    expect(screen.getByTestId('hint-preview-output')).toHaveTextContent(
      'Best discard highlighted in hand.'
    );
  });

  test('calls onChange when hint sound is toggled', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <HintSettingsSection
        settings={settings}
        onChange={onChange}
        onReset={vi.fn()}
        onTestSound={vi.fn()}
      />
    );

    await user.click(screen.getByLabelText('Hint Sound'));
    expect(onChange).toHaveBeenCalledWith({
      ...settings,
      sound_enabled: false,
    });
  });

  test('calls onTestSound with selected sound type', async () => {
    const onTestSound = vi.fn();
    const { user } = renderWithProviders(
      <HintSettingsSection
        settings={settings}
        onChange={vi.fn()}
        onReset={vi.fn()}
        onTestSound={onTestSound}
      />
    );

    await user.click(screen.getByTestId('hint-sound-test-button'));
    expect(onTestSound).toHaveBeenCalledWith('Chime');
  });

  test('calls onReset when reset button is clicked', async () => {
    const onReset = vi.fn();
    const { user } = renderWithProviders(
      <HintSettingsSection
        settings={settings}
        onChange={vi.fn()}
        onReset={onReset}
        onTestSound={vi.fn()}
      />
    );

    await user.click(screen.getByTestId('hint-settings-reset-button'));
    expect(onReset).toHaveBeenCalledOnce();
  });
});
