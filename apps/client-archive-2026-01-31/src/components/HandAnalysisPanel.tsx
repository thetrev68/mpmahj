import { useMemo } from 'react';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import { useHint } from '@/store/analysisStore';
import { tileToCode } from '@/utils/tileFormatter';
import { useHandAnalysis } from '@/hooks/useHandAnalysis';
import { PatternVisualization } from '@/components/PatternVisualization';
import './HandAnalysisPanel.css';

interface HandAnalysisPanelProps {
  isOpen: boolean;
  onClose: () => void;
  sendCommand: (command: GameCommand) => boolean;
}

export function HandAnalysisPanel({ isOpen, onClose, sendCommand }: HandAnalysisPanelProps) {
  const hint = useHint();
  const {
    patterns: allPatterns,
    handStats,
    isLoading,
    requestAnalysis,
  } = useHandAnalysis({
    isOpen,
    sendCommand,
  });

  // Filter and limit patterns to show only the most relevant ones
  const patterns = useMemo(() => {
    return allPatterns
      .filter((p) => p.viable) // Only show viable patterns
      .sort((a, b) => {
        // Sort by expected value (probability × score) descending to match hint manager
        const evA = a.probability * a.score;
        const evB = b.probability * b.score;
        return evB - evA;
      })
      .slice(0, 20); // Limit to top 20 patterns
  }, [allPatterns]);

  const recommendedDiscard = hint?.recommended_discard ?? null;
  const discardLabel = useMemo(
    () => (recommendedDiscard != null ? tileToCode(recommendedDiscard) : 'N/A'),
    [recommendedDiscard]
  );
  const tilesNeeded = hint?.tiles_needed_for_win ?? [];
  const distanceToWin = handStats?.distance_to_win ?? hint?.distance_to_win ?? null;
  let waitingStatus = 'Unknown';
  if (hint?.hot_hand) {
    waitingStatus = 'Waiting';
  } else if (typeof distanceToWin === 'number') {
    waitingStatus = distanceToWin <= 1 ? 'Waiting' : 'Not waiting';
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div className="hand-analysis-panel">
      <div className="hand-analysis-header">
        <h3>Hand Analysis</h3>
        <div className="hand-analysis-actions">
          <button onClick={requestAnalysis} disabled={isLoading}>
            {isLoading ? 'Loading...' : 'Refresh Analysis'}
          </button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>

      <div className="hand-analysis-section">
        <div>
          Showing Top {patterns.length} Viable Patterns
          {handStats
            ? ` (Total Viable: ${handStats.viable_count}, Impossible: ${handStats.impossible_count})`
            : ''}
        </div>
        {patterns.length === 0 ? (
          <div className="hand-analysis-muted">No viable patterns found.</div>
        ) : (
          patterns.map((pattern, index) => (
            <PatternVisualization
              key={`${pattern.pattern_name}-${index}-${pattern.score}`}
              pattern={pattern}
            />
          ))
        )}
      </div>

      <div className="hand-analysis-section">
        <div>
          <strong>Win Probability:</strong> Included per pattern.
        </div>
        <div>
          <strong>Pattern Scores:</strong> Included per pattern.
        </div>
        <div>
          <strong>Recommended Discard:</strong> {discardLabel}
        </div>
        <div>
          <strong>Dead Tiles:</strong> Not provided by backend.
        </div>
        <div>
          <strong>Waiting Status:</strong> {waitingStatus}
        </div>
        <div>
          <strong>Outs Count:</strong>{' '}
          {tilesNeeded.length > 0 ? tilesNeeded.length : 'Not provided'}
        </div>
        <div>
          <strong>Tiles Needed:</strong>{' '}
          {tilesNeeded.length > 0 ? tilesNeeded.map((tile) => tileToCode(tile)).join(', ') : 'N/A'}
        </div>
      </div>
    </div>
  );
}
