import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

interface AudioSettingsSectionProps {
  soundEffectsEnabled: boolean;
  soundEffectsVolume: number;
  musicEnabled: boolean;
  musicVolume: number;
  onSoundEffectsEnabledChange: (enabled: boolean) => void;
  onSoundEffectsVolumeChange: (volume: number) => void;
  onMusicEnabledChange: (enabled: boolean) => void;
  onMusicVolumeChange: (volume: number) => void;
}

export function AudioSettingsSection({
  soundEffectsEnabled,
  soundEffectsVolume,
  musicEnabled,
  musicVolume,
  onSoundEffectsEnabledChange,
  onSoundEffectsVolumeChange,
  onMusicEnabledChange,
  onMusicVolumeChange,
}: AudioSettingsSectionProps) {
  return (
    <Card className="space-y-4 p-4" data-testid="audio-settings-section">
      <h3 className="text-lg font-semibold">Audio</h3>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="sound-effects-toggle">Sound Effects</Label>
          <Switch
            id="sound-effects-toggle"
            checked={soundEffectsEnabled}
            onCheckedChange={onSoundEffectsEnabledChange}
            data-testid="sound-effects-toggle"
          />
        </div>
        <Slider
          aria-label="Sound Effects volume"
          min={0}
          max={1}
          step={0.1}
          value={[soundEffectsVolume]}
          onValueChange={([value]) => onSoundEffectsVolumeChange(value ?? soundEffectsVolume)}
          data-testid="sound-effects-volume"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="music-toggle">
            Background Music <span className="text-xs text-muted-foreground">(Coming soon)</span>
          </Label>
          <Switch
            id="music-toggle"
            checked={musicEnabled}
            onCheckedChange={onMusicEnabledChange}
            data-testid="music-toggle"
          />
        </div>
        <Slider
          aria-label="Background Music volume"
          min={0}
          max={1}
          step={0.1}
          value={[musicVolume]}
          onValueChange={([value]) => onMusicVolumeChange(value ?? musicVolume)}
          data-testid="music-volume"
        />
      </div>
    </Card>
  );
}
