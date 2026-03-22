import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { HintSettings } from '@/lib/hintSettings';

interface HintSettingsSectionProps {
  settings: HintSettings;
  onChange: (settings: HintSettings) => void;
}

export function HintSettingsSection({ settings, onChange }: HintSettingsSectionProps) {
  return (
    <Card className="space-y-4 p-4" data-testid="hint-settings-section">
      <h3 className="text-lg font-semibold">Hints</h3>
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="use-hints-toggle">Use Hints</Label>
        <Switch
          id="use-hints-toggle"
          checked={settings.useHints}
          onCheckedChange={(checked) => onChange({ ...settings, useHints: checked })}
          data-testid="use-hints-toggle"
        />
      </div>
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="sort-discards-toggle">Sort Discard Pile</Label>
        <Switch
          id="sort-discards-toggle"
          checked={settings.sortDiscards}
          onCheckedChange={(checked) => onChange({ ...settings, sortDiscards: checked })}
          data-testid="sort-discards-toggle"
        />
      </div>
    </Card>
  );
}
