/**
 * @module HintPanel
 *
 * Displays AI-recommended discard strategies with tile and utility scores.
 * Respects the verbosity setting to show/hide detailed reasoning.
 * Content varies by {@link HintVerbosity} level (Beginner shows patterns,
 * Intermediate shows short reason, Expert/Disabled show nothing).
 *
 * @see {@link src/lib/hintSettings.ts} for hint preference persistence
 * @see {@link src/types/bindings/generated/HintData.ts} for Rust-generated data shape
 */

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getTileName } from '@/lib/utils/tileUtils';
import type { HintData } from '@/types/bindings/generated/HintData';
import type { HintVerbosity } from '@/types/bindings/generated/HintVerbosity';

/**
 * Props for the HintPanel component.
 *
 * @interface HintPanelProps
 * @property {HintData} hint - AI hint data containing recommended discard, tile scores, patterns.
 *   @see {@link src/types/bindings/generated/HintData.ts}
 * @property {HintVerbosity} verbosity - Level of detail to display (Beginner/Intermediate/Expert/Disabled).
 * @property {() => void} onClose - Callback when user closes the panel.
 */
export interface HintPanelProps {
  hint: HintData;
  verbosity: HintVerbosity;
  onClose: () => void;
}

/**
 * Converts a score dictionary to sorted [tile, score] tuples for display.
 * Sorts by descending score (highest first). Used for tile scores and utility scores.
 *
 * @internal
 * @param {Record<number, number>} scores - Map of tile index (0-41) to numeric score
 * @returns {Array<[number, number]>} Sorted tuples [tile, score]
 */
function sortNumericScoreEntries(scores: Record<number, number>): Array<[number, number]> {
  return Object.entries(scores)
    .map(([tile, score]) => [Number(tile), score] as [number, number])
    .sort((a, b) => b[1] - a[1]);
}

export function HintPanel({ hint, verbosity, onClose }: HintPanelProps) {
  const tileScores = sortNumericScoreEntries(hint.tile_scores);
  const utilityScores = sortNumericScoreEntries(hint.utility_scores);
  const discardName =
    hint.recommended_discard === null
      ? 'No discard recommendation'
      : getTileName(hint.recommended_discard);

  return (
    <Card
      className="fixed left-6 top-20 z-40 w-[380px] border-cyan-400/50 bg-slate-950/95 p-4 text-slate-100"
      data-testid="hint-panel"
      role="complementary"
      aria-label="AI hint panel"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">AI Hint</h2>
        <Button variant="outline" size="sm" onClick={onClose} data-testid="close-hint-panel">
          Close
        </Button>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Recommended discard</p>
          <p className="text-base font-medium text-cyan-300" data-testid="hint-recommended-discard">
            {discardName}
          </p>
        </div>

        {verbosity !== 'Expert' && hint.discard_reason && (
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Reason</p>
            <p data-testid="hint-discard-reason">{hint.discard_reason}</p>
          </div>
        )}

        {verbosity === 'Beginner' && hint.best_patterns.length > 0 && (
          <div data-testid="hint-best-patterns">
            <p className="text-xs uppercase tracking-wide text-slate-400">Top patterns</p>
            <ul className="mt-1 space-y-1 text-sm">
              {hint.best_patterns.map((pattern) => (
                <li key={`${pattern.pattern_id}-${pattern.variation_id}`}>
                  {pattern.pattern_name} ({Math.round(pattern.probability * 100)}%)
                </li>
              ))}
            </ul>
          </div>
        )}

        {tileScores.length > 0 && (
          <div data-testid="hint-tile-scores">
            <p className="text-xs uppercase tracking-wide text-slate-400">Tile scores</p>
            <ul className="mt-1 space-y-1 text-sm">
              {tileScores.slice(0, 5).map(([tile, score]) => (
                <li key={`tile-score-${tile}`} className="flex justify-between">
                  <span>{getTileName(tile)}</span>
                  <span>{score.toFixed(1)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {utilityScores.length > 0 && (
          <div data-testid="hint-utility-scores">
            <p className="text-xs uppercase tracking-wide text-slate-400">Utility scores</p>
            <ul className="mt-1 space-y-1 text-sm">
              {utilityScores.slice(0, 5).map(([tile, score]) => (
                <li key={`utility-score-${tile}`} className="flex justify-between">
                  <span>{getTileName(tile)}</span>
                  <span>{score.toFixed(1)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
