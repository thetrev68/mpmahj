import type { PatternAnalysis } from '@/types/bindings/generated/PatternAnalysis';
import { histogramToString } from '@/utils/tileFormatter';

interface PatternVisualizationProps {
  pattern: PatternAnalysis;
}

const getProbabilityClass = (probability: number) => {
  if (probability >= 0.66) return 'high';
  if (probability >= 0.33) return 'medium';
  return 'low';
};

export function PatternVisualization({ pattern }: PatternVisualizationProps) {
  const probabilityPercent = Math.round(pattern.probability * 100);
  const probabilityClass = getProbabilityClass(pattern.probability);

  return (
    <div className="pattern-visualization">
      <div className="pattern-header">
        <span className={`pattern-probability ${probabilityClass}`}>{probabilityPercent}%</span>
        <span className="pattern-name">{pattern.pattern_name}</span>
      </div>
      <div className="pattern-details">
        Score: {pattern.score} | Distance: {pattern.distance} | Difficulty: {pattern.difficulty} |{' '}
        {pattern.viable ? 'Viable' : 'Not viable'}
      </div>
      <div className="pattern-description">{pattern.pattern_description}</div>
      <div className="pattern-tiles">{histogramToString(pattern.pattern_tiles)}</div>
    </div>
  );
}
