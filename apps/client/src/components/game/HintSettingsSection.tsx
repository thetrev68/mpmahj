/**
 * @module HintSettingsSection
 *
 * Configurable settings for AI hints: verbosity level, preview switcher, sound preferences.
 * Includes a live preview of each verbosity mode and test button for hint sounds.
 * Supports localStorage persistence via {@link src/lib/hintSettings.ts}.
 *
 * @see {@link src/lib/hintSettings.ts} for localStorage key and defaults
 * @see {@link src/components/game/HintPanel.tsx} for hint display component
 */

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { HintVerbosity } from '@/types/bindings/generated/HintVerbosity';
import type { HintSettings, HintSoundType } from '@/lib/hintSettings';

/**
 * Props for the HintSettingsSection component.
 *
 * @interface HintSettingsSectionProps
 * @property {HintSettings} settings - Current hint settings (verbosity, sound enabled, sound type).
 *   @see {@link src/lib/hintSettings.ts}
 * @property {(settings: HintSettings) => void} onChange - Callback fired on any setting change.
 * @property {() => void} onReset - Callback for reset-to-defaults button.
 * @property {(soundType: HintSoundType) => void} onTestSound - Callback to play a test sound.
 *   Consumer typically triggers sound via audio manager (e.g., useSoundEffects).
 */
interface HintSettingsSectionProps {
  settings: HintSettings;
  onChange: (settings: HintSettings) => void;
  onReset: () => void;
  onTestSound: (soundType: HintSoundType) => void;
}

const VERBOSITY_OPTIONS: Array<{
  value: HintVerbosity;
  label: string;
  description: string;
  preview: string;
}> = [
  {
    value: 'Beginner',
    label: 'Beginner',
    description: 'Full reasoning with a short explanation',
    preview: 'Discard 7 Bamboo. Keeps options for Consecutive Run.',
  },
  {
    value: 'Intermediate',
    label: 'Intermediate',
    description: 'Short label (best discard only)',
    preview: 'Discard 7 Bamboo.',
  },
  {
    value: 'Expert',
    label: 'Expert',
    description: 'Visual highlight only',
    preview: 'Best discard highlighted in hand.',
  },
  {
    value: 'Disabled',
    label: 'Disabled',
    description: 'No hints shown',
    preview: 'Hints are turned off.',
  },
];

export function HintSettingsSection({
  settings,
  onChange,
  onReset,
  onTestSound,
}: HintSettingsSectionProps) {
  const [previewVerbosity, setPreviewVerbosity] = useState<HintVerbosity>(settings.verbosity);
  const previewText = useMemo(
    () =>
      VERBOSITY_OPTIONS.find((option) => option.value === previewVerbosity)?.preview ??
      'No preview available',
    [previewVerbosity]
  );

  return (
    <Card
      className="space-y-4 border-slate-700 bg-slate-950/80 p-4 text-slate-100"
      data-testid="hint-settings-section"
    >
      <h3 className="text-lg font-semibold">Hints</h3>

      <div className="space-y-2">
        <Label htmlFor="hint-verbosity-select">Hint Verbosity</Label>
        <Select
          value={settings.verbosity}
          onValueChange={(value) =>
            onChange({
              ...settings,
              verbosity: value as HintVerbosity,
            })
          }
        >
          <SelectTrigger id="hint-verbosity-select" data-testid="hint-verbosity-select">
            <SelectValue placeholder="Select verbosity" />
          </SelectTrigger>
          <SelectContent>
            {VERBOSITY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-slate-300">Preview each verbosity level</p>
        {VERBOSITY_OPTIONS.map((option) => (
          <div
            key={`preview-${option.value}`}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <div>
              <div className="font-medium">{option.label}</div>
              <div className="text-slate-400">{option.description}</div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewVerbosity(option.value)}
              data-testid={`hint-preview-${option.value}`}
            >
              Preview
            </Button>
          </div>
        ))}
        <div
          className="rounded border border-cyan-700/60 bg-cyan-950/30 p-2 text-sm"
          data-testid="hint-preview-output"
        >
          {previewText}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="hint-sound-enabled"
            checked={settings.sound_enabled}
            onCheckedChange={(checked) =>
              onChange({
                ...settings,
                sound_enabled: checked === true,
              })
            }
          />
          <Label htmlFor="hint-sound-enabled">Hint Sound</Label>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={settings.sound_type}
            onValueChange={(value) =>
              onChange({
                ...settings,
                sound_type: value as HintSoundType,
              })
            }
          >
            <SelectTrigger data-testid="hint-sound-type-select">
              <SelectValue placeholder="Sound Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Chime">Chime</SelectItem>
              <SelectItem value="Ping">Ping</SelectItem>
              <SelectItem value="Bell">Bell</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => onTestSound(settings.sound_type)}
            data-testid="hint-sound-test-button"
          >
            Test
          </Button>
        </div>
      </div>

      <Button variant="destructive" onClick={onReset} data-testid="hint-settings-reset-button">
        Reset Hint Settings to Default
      </Button>
    </Card>
  );
}
