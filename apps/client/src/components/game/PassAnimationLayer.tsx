import React from 'react';
import { Card } from '@/components/ui/card';
import type { PassDirection } from '@/types/bindings/generated/PassDirection';
import './PassAnimationLayer.css';

interface PassAnimationLayerProps {
  direction: PassDirection;
}

const directionLabel: Record<PassDirection, string> = {
  Right: 'Passing Right â†’',
  Across: 'Passing Across â†”',
  Left: 'Passing Left â†',
};

export const PassAnimationLayer: React.FC<PassAnimationLayerProps> = ({ direction }) => {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center pointer-events-none"
      data-testid="pass-animation-layer"
      aria-live="polite"
    >
      <Card className="px-6 py-3 bg-black/80 text-white pass-animation-card">
        <div className="text-lg font-semibold">{directionLabel[direction]}</div>
      </Card>
    </div>
  );
};

PassAnimationLayer.displayName = 'PassAnimationLayer';
