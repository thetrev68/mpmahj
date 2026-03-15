/**
 * @module AnimationSettings
 *
 * Read-only animation policy status card.
 */

import { Card } from '@/components/ui/card';

interface AnimationSettingsProps {
  prefersReducedMotion?: boolean;
}

export function AnimationSettings({ prefersReducedMotion = false }: AnimationSettingsProps) {
  return (
    <Card className="space-y-3 p-4" data-testid="animation-settings-card">
      <h3 className="text-lg font-semibold">Animations</h3>
      <p className="text-sm text-muted-foreground" data-testid="animation-policy-status">
        {prefersReducedMotion
          ? 'Animations are off because reduced motion is enabled in your operating system settings.'
          : 'Animations are on at normal speed. Use your operating system reduced motion setting to disable them.'}
      </p>
    </Card>
  );
}
