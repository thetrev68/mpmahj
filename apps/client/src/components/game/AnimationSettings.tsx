/**
 * @module AnimationSettings
 *
 * Configurable animation preferences: global speed (off/fast/normal/slow), per-animation toggles,
 * and reduced motion respect. Respects system prefers-reduced-motion CSS media query.
 * Integrates with {@link src/hooks/useAnimationSettings.ts} for localStorage persistence.
 *
 * @see {@link src/hooks/useAnimationSettings.ts} for persistence logic
 */

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
import type { AnimationPreferences, AnimationSpeed } from '@/hooks/useAnimationSettings';

/**
 * Props for the AnimationSettings component.
 *
 * @interface AnimationSettingsProps
 * @property {AnimationPreferences} settings - Current animation preferences (speed, toggles, reduced-motion flag).
 *   @see {@link src/hooks/useAnimationSettings.ts} for type definition
 * @property {(settings: AnimationPreferences) => void} onChange - Callback fired on any setting change.
 * @property {boolean} [prefersReducedMotion=false] - System prefers-reduced-motion preference.
 *   Shows banner when true; does not auto-disable animations (respects user override via checkbox).
 * @property {boolean} [showAdvanced=true] - Whether to show per-animation toggles (tile_movement, charleston_pass, etc).
 *   Simple UI hides these when false.
 */
interface AnimationSettingsProps {
  settings: AnimationPreferences;
  onChange: (settings: AnimationPreferences) => void;
  prefersReducedMotion?: boolean;
  showAdvanced?: boolean;
}

const TOGGLE_OPTIONS: Array<{
  key: keyof Pick<
    AnimationPreferences,
    'tile_movement' | 'charleston_pass' | 'meld_formation' | 'dice_roll' | 'win_celebration'
  >;
  label: string;
}> = [
  { key: 'tile_movement', label: 'Tile movement' },
  { key: 'charleston_pass', label: 'Charleston passing' },
  { key: 'meld_formation', label: 'Meld formation' },
  { key: 'dice_roll', label: 'Dice roll' },
  { key: 'win_celebration', label: 'Win celebration' },
];

export function AnimationSettings({
  settings,
  onChange,
  prefersReducedMotion = false,
  showAdvanced = true,
}: AnimationSettingsProps) {
  const handleSpeedChange = (speed: AnimationSpeed) => {
    onChange({
      ...settings,
      speed,
    });
  };

  return (
    <Card className="space-y-4 border-slate-700 bg-slate-950/80 p-4 text-slate-100">
      <h3 className="text-lg font-semibold">Animations</h3>

      {prefersReducedMotion && (
        <p
          className="rounded border border-amber-600/60 bg-amber-950/40 p-2 text-sm text-amber-200"
          data-testid="reduced-motion-banner"
        >
          Reduced motion is enabled by your system preference.
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="animation-speed">Animation Speed</Label>
        <Select
          value={settings.speed}
          onValueChange={(value) => handleSpeedChange(value as AnimationSpeed)}
        >
          <SelectTrigger id="animation-speed" data-testid="animation-speed-select">
            <SelectValue placeholder="Select speed" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="off">Off</SelectItem>
            <SelectItem value="fast">Fast</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="slow">Slow</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {showAdvanced && (
        <div className="space-y-3">
          {TOGGLE_OPTIONS.map((option) => (
            <div key={option.key} className="flex items-center space-x-2">
              <Checkbox
                id={`animation-${option.key}`}
                checked={settings[option.key]}
                onCheckedChange={(checked) =>
                  onChange({
                    ...settings,
                    [option.key]: checked === true,
                  })
                }
              />
              <Label htmlFor={`animation-${option.key}`}>{option.label}</Label>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center space-x-2">
        <Checkbox
          id="respect-reduced-motion"
          checked={settings.respect_reduced_motion}
          onCheckedChange={(checked) =>
            onChange({
              ...settings,
              respect_reduced_motion: checked === true,
            })
          }
        />
        <Label htmlFor="respect-reduced-motion">Respect reduced motion preference</Label>
      </div>
    </Card>
  );
}
