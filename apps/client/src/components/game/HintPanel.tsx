import { Card } from '@/components/ui/card';
import { TileImage } from './TileImage';
import type { HintData } from '@/types/bindings/generated/HintData';
import type { PatternSummary } from '@/types/bindings/generated/PatternSummary';

interface HintPanelProps {
  hint: HintData;
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

function formatCompactNumber(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }

  if (Math.abs(value) >= 1) {
    return value.toFixed(2);
  }

  return value.toFixed(3);
}

function getPatternVariantLabel(
  pattern: PatternSummary,
  duplicateNameCounts: Map<string, number>
): string | null {
  if ((duplicateNameCounts.get(pattern.pattern_name) ?? 0) > 1) {
    return pattern.variation_id || pattern.pattern_id;
  }

  return pattern.variation_id || pattern.pattern_id;
}

export function HintPanel({ hint }: HintPanelProps) {
  const bestPatterns = hint.best_patterns.slice(0, 3);
  const duplicateNameCounts = bestPatterns.reduce((counts, pattern) => {
    counts.set(pattern.pattern_name, (counts.get(pattern.pattern_name) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  const isCharlestonHint = hint.charleston_pass_recommendations.length > 0;
  const discardName = hint.recommended_discard === null ? 'No discard recommendation' : undefined;

  return (
    <Card
      className="h-full overflow-auto border bg-card p-4 text-card-foreground dark:bg-slate-900"
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
            <div className="mt-1 flex gap-1" data-testid="hint-pass-tiles">
              {hint.charleston_pass_recommendations.map((tile, i) => (
                <TileImage
                  key={`pass-tile-${tile}-${i}`}
                  tile={tile}
                  className="h-8 w-6"
                  testId={`hint-pass-tile-${i}`}
                />
              ))}
            </div>
          </div>
        ) : (
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Recommended discard
            </p>
            {hint.recommended_discard !== null ? (
              <div className="mt-1 flex items-center gap-2" data-testid="hint-recommended-discard">
                <TileImage
                  tile={hint.recommended_discard}
                  className="h-8 w-6"
                  testId="hint-discard-tile"
                />
              </div>
            ) : (
              <p
                className="text-base font-medium text-primary"
                data-testid="hint-recommended-discard"
              >
                {discardName}
              </p>
            )}
            {hint.discard_reason && (
              <p className="mt-0.5 text-sm text-muted-foreground" data-testid="hint-discard-reason">
                {hint.discard_reason}
              </p>
            )}
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
                    className="rounded-md border border-border/70 bg-background p-2 dark:bg-slate-950"
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
                    {pattern.pattern_tiles.length > 0 && (
                      <div
                        className="mt-1.5 flex flex-wrap gap-0.5"
                        data-testid={`hint-pattern-tiles-${index}`}
                      >
                        {pattern.pattern_tiles.map((tile, tileIdx) => (
                          <TileImage
                            key={`pattern-${index}-tile-${tileIdx}`}
                            tile={tile}
                            className="h-5 w-4"
                            testId={`hint-pattern-${index}-tile-${tileIdx}`}
                          />
                        ))}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span data-testid={`hint-pattern-exposure-${index}`}>
                        {pattern.concealed ? 'C' : 'X'}
                      </span>
                      <span>Distance {pattern.distance}</span>
                      <span>Win chance {formatProbability(pattern.probability)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
