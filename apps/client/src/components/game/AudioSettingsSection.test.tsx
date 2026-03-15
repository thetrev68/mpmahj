import { fireEvent } from '@testing-library/react';
import { beforeAll, describe, expect, test, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { AudioSettingsSection } from './AudioSettingsSection';

describe('AudioSettingsSection', () => {
  beforeAll(() => {
    Object.defineProperty(Element.prototype, 'hasPointerCapture', {
      configurable: true,
      value: vi.fn(() => false),
    });
    Object.defineProperty(Element.prototype, 'setPointerCapture', {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(Element.prototype, 'releasePointerCapture', {
      configurable: true,
      value: vi.fn(),
    });
  });

  test('renders the audio controls with no hardcoded dark-palette classes', () => {
    renderWithProviders(
      <AudioSettingsSection
        soundEffectsEnabled={true}
        soundEffectsVolume={0.5}
        musicEnabled={true}
        musicVolume={0.5}
        onSoundEffectsEnabledChange={vi.fn()}
        onSoundEffectsVolumeChange={vi.fn()}
        onMusicEnabledChange={vi.fn()}
        onMusicVolumeChange={vi.fn()}
      />
    );

    const section = screen.getByTestId('audio-settings-section');
    expect(screen.getByTestId('sound-effects-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('sound-effects-volume')).toBeInTheDocument();
    expect(screen.getByTestId('music-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('music-volume')).toBeInTheDocument();
    expect(section.className).not.toMatch(/bg-slate-|text-slate-|border-slate-|bg-cyan-/);
  });

  test('fires toggle callbacks', async () => {
    const onSoundEffectsEnabledChange = vi.fn();
    const onMusicEnabledChange = vi.fn();
    const { user } = renderWithProviders(
      <AudioSettingsSection
        soundEffectsEnabled={true}
        soundEffectsVolume={0.5}
        musicEnabled={true}
        musicVolume={0.5}
        onSoundEffectsEnabledChange={onSoundEffectsEnabledChange}
        onSoundEffectsVolumeChange={vi.fn()}
        onMusicEnabledChange={onMusicEnabledChange}
        onMusicVolumeChange={vi.fn()}
      />
    );

    await user.click(screen.getByTestId('sound-effects-toggle'));
    await user.click(screen.getByTestId('music-toggle'));

    expect(onSoundEffectsEnabledChange).toHaveBeenCalledWith(false);
    expect(onMusicEnabledChange).toHaveBeenCalledWith(false);
  });

  test('fires volume callbacks', async () => {
    const onSoundEffectsVolumeChange = vi.fn();
    const onMusicVolumeChange = vi.fn();
    renderWithProviders(
      <AudioSettingsSection
        soundEffectsEnabled={true}
        soundEffectsVolume={0.5}
        musicEnabled={true}
        musicVolume={0.5}
        onSoundEffectsEnabledChange={vi.fn()}
        onSoundEffectsVolumeChange={onSoundEffectsVolumeChange}
        onMusicEnabledChange={vi.fn()}
        onMusicVolumeChange={onMusicVolumeChange}
      />
    );

    fireEvent.keyDown(screen.getByRole('slider', { name: 'Sound Effects volume' }), {
      key: 'ArrowRight',
    });
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Background Music volume' }), {
      key: 'ArrowRight',
    });

    expect(onSoundEffectsVolumeChange).toHaveBeenCalled();
    expect(onMusicVolumeChange).toHaveBeenCalled();
  });
});
