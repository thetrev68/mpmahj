import { useMemo } from 'react';
import { useHint, useRecommendedDiscard, useDistanceToWin } from '@/store/analysisStore';
import { tileToCode } from '@/utils/tileFormatter';

export function HintPanel() {
  const enabled = (import.meta.env.VITE_ENABLE_HINTS ?? 'true') === 'true';
  if (!enabled) return null;

  const hint = useHint();
  const discard = useRecommendedDiscard();
  const distance = useDistanceToWin();

  const discardLabel = useMemo(() => (discard != null ? tileToCode(discard) : '—'), [discard]);

  if (!hint && discard == null && distance == null) return null;

  return (
    <div style={{ marginTop: 8, marginBottom: 8, padding: 8, border: '1px solid #ddd' }}>
      <div><strong>Hint:</strong> Discard {discardLabel}</div>
      {hint?.discard_reason ? (
        <div style={{ fontSize: '0.9em', color: '#555' }}>{hint.discard_reason}</div>
      ) : null}
      {hint?.hot_hand ? <div style={{ color: '#b00' }}>Hot hand</div> : null}
      {typeof distance === 'number' ? (
        <div style={{ fontSize: '0.9em' }}>Distance to win: {distance}</div>
      ) : null}
    </div>
  );
}
