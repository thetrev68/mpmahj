/**
 * @module PassAnimationLayer
 *
 * Renders a centered, full-screen overlay during tile passing stages in Charleston phase.
 * Displays the pass direction (Right/Across/Left) with animated entry/exit.
 *
 * Purely presentational; actual tile movement is handled by `src/components/game/GameBoard.tsx`.
 * CSS animations defined in `./PassAnimationLayer.css` create fade-in/slide effects.
 *
 * @see `./PassAnimationLayer.css` for animation timing
 * @see `src/components/game/CharlestonPhase.tsx` for Charleston phase orchestration
 */

import type { FC } from 'react';
import { Card } from '@/components/ui/card';
import type { PassDirection } from '@/types/bindings/generated/PassDirection';
import './PassAnimationLayer.css';

/**
 * Props for the PassAnimationLayer component.
 *
 * @interface PassAnimationLayerProps
 * @property {PassDirection} direction - The direction of the current pass. One of 'Right', 'Across', or 'Left'.
 *   Used to select the appropriate label and visual style.
 *   @see `src/types/bindings/generated/PassDirection.ts` for enum values
 */
interface PassAnimationLayerProps {
  direction: PassDirection;
}

const directionLabel: Record<PassDirection, string> = {
  Right: 'Passing Right \u2192',
  Across: 'Passing Across \u2194',
  Left: 'Passing Left \u2190',
};

export const PassAnimationLayer: FC<PassAnimationLayerProps> = ({ direction }) => {
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
