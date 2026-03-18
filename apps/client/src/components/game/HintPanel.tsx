import { Card } from '@/components/ui/card';
import { getTileName } from '@/lib/utils/tileUtils';
import type { HintData } from '@/types/bindings/generated/HintData';
import type { PatternSummary } from '@/types/bindings/generated/PatternSummary';

interface HintPanelProps {
  hint: HintData;
}

function sortNumericScoreEntries(scores: Record<number, number>): Array<[number, number]> {
  return Object.entries(scores)
    .map(([tile, score]) => [Number(tile), score] as [number, number])
    .sort((a, b) => b[1] - a[1]);
}

function formatCompactNumber(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }

  if (Math.abs(value) >= 1) {
    return value.toFixed(2);
  }

  return value.toFixed(3);
}

function formatProbability(probability: number): string {
  const percent = probability * 100;

  if (percent >= 10) {
    return `${percent.toFixed(0)}%`;
  }

  if (percent >= 1) {
    return `${percent.toFixed(1)}%`;
  }

  return `${percent.toFixed(2)}%`;
}

function getPatternVariantLabel(
  pattern: PatternSummary,
  duplicateNameCounts: Map<string, number>
): string | null {
  if ((duplicateNameCounts.get(pattern.pattern_name) ?? 0) <= 1) {
    return null;
  }

  return pattern.variation_id || pattern.pattern_id;
}

export function HintPanel({ hint }: HintPanelProps) {
  const tileScores = sortNumericScoreEntries(hint.tile_scores);
  const utilityScores = sortNumericScoreEntries(hint.utility_scores);
  const bestPatterns = hint.best_patterns.slice(0, 3);
  const duplicateNameCounts = bestPatterns.reduce((counts, pattern) => {
    counts.set(pattern.pattern_name, (counts.get(pattern.pattern_name) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  const isCharlestonHint = hint.charleston_pass_recommendations.length > 0;
  const discardName =
    hint.recommended_discard === null
      ? 'No discard recommendation'
      : getTileName(hint.recommended_discard);

  return (
    <Card
      className="h-full overflow-auto border bg-card/90 p-4 text-card-foreground"
      data-testid="hint-panel"
      role="complementary"
      aria-label="AI hint panel"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Current Recommendation</h3>
      </div>

      <div className="space-y-3">
        {isCharlestonHint ? (
          <div data-testid="hint-charleston-pass-recommendations">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Recommended pass
            </p>
            <ul className="mt-1 space-y-1 text-sm">
              {hint.charleston_pass_recommendations.map((tile) => (
                <li key={tile} className="text-base font-medium text-primary">
                  {getTileName(tile)}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Recommended discard
            </p>
            <p
              className="text-base font-medium text-primary"
              data-testid="hint-recommended-discard"
            >
              {discardName}
            </p>
            {hint.discard_reason && (
              <p className="mt-0.5 text-sm text-muted-foreground" data-testid="hint-discard-reason">
                {hint.discard_reason}
              </p>
            )}
          </div>
        )}

        {tileScores.length > 0 && (
          <div data-testid="hint-tile-scores">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Tile scores</p>
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

        {bestPatterns.length > 0 && (
          <div data-testid="hint-best-patterns">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Patterns to play for
            </p>
            <ul className="mt-2 space-y-2">
              {bestPatterns.map((pattern, index) => {
                const variantLabel = getPatternVariantLabel(pattern, duplicateNameCounts);

                return (
                  <li
                    key={`${pattern.pattern_id}-${pattern.variation_id}-${index}`}
                    className="rounded-md border border-border/70 bg-background/50 p-2"
                    data-testid={`hint-best-pattern-${index}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {pattern.pattern_name}
                        </p>
                        {variantLabel && (
                          <p className="text-xs text-muted-foreground">{variantLabel}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-primary">
                        {formatCompactNumber(pattern.score)} pts
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>Distance {pattern.distance}</span>
                      <span>Win chance {formatProbability(pattern.probability)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {utilityScores.length > 0 && (
          <div data-testid="hint-utility-scores">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Utility scores</p>
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
