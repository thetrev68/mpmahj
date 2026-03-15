import { Card } from '@/components/ui/card';
import { getTileName } from '@/lib/utils/tileUtils';
import type { HintData } from '@/types/bindings/generated/HintData';

interface HintPanelProps {
  hint: HintData;
}

function sortNumericScoreEntries(scores: Record<number, number>): Array<[number, number]> {
  return Object.entries(scores)
    .map(([tile, score]) => [Number(tile), score] as [number, number])
    .sort((a, b) => b[1] - a[1]);
}

export function HintPanel({ hint }: HintPanelProps) {
  const tileScores = sortNumericScoreEntries(hint.tile_scores);
  const utilityScores = sortNumericScoreEntries(hint.utility_scores);
  const discardName =
    hint.recommended_discard === null
      ? 'No discard recommendation'
      : getTileName(hint.recommended_discard);

  return (
    <Card
      className="h-full overflow-auto border-cyan-400/50 bg-slate-950/95 p-4 text-slate-100"
      data-testid="hint-panel"
      role="complementary"
      aria-label="AI hint panel"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Current Recommendation</h2>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Recommended discard</p>
          <p className="text-base font-medium text-cyan-300" data-testid="hint-recommended-discard">
            {discardName}
          </p>
        </div>

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
