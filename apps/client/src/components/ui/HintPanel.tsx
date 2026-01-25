import { useMemo } from 'react';
import { useHint, useHintsBySource } from '@/store/analysisStore';
import { useGameStore } from '@/store/gameStore';
import { tileToCode } from '@/utils/tileFormatter';
import type { HintData } from '@/types/bindings/generated/HintData';

interface SingleHintProps {
  hint: HintData | null;
  label?: string;
}

function SingleHint({ hint, label }: SingleHintProps) {
  const phase = useGameStore((state) => state.phase);
  const discard = hint?.recommended_discard ?? null;
  const distance = hint?.distance_to_win;
  const tilesNeeded = hint?.tiles_needed_for_win ?? [];

  const discardLabel = useMemo(() => (discard != null ? tileToCode(discard) : '—'), [discard]);

  // Check if in Charleston phase
  const isCharleston = typeof phase === 'object' && phase !== null && 'Charleston' in phase;

  if (!hint) return null;

  return (
    <div style={{ marginTop: 8, marginBottom: 8, padding: 8, border: '1px solid #ddd' }}>
      {label ? <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{label}</div> : null}
      <div>
        {isCharleston ? (
          <>
            <strong>Charleston:</strong> Pass 3 tiles
          </>
        ) : (
          <>
            <strong>Hint:</strong> Discard {discardLabel}
          </>
        )}
      </div>
      {hint?.discard_reason ? (
        <div style={{ fontSize: '0.9em', color: '#555' }}>{hint.discard_reason}</div>
      ) : null}
      {hint?.hot_hand ? <div style={{ color: '#b00' }}>Hot hand</div> : null}
      {typeof distance === 'number' && distance < 14 ? (
        <div style={{ fontSize: '0.9em' }}>Distance to win: {distance}</div>
      ) : null}
      {tilesNeeded.length > 0 ? (
        <div style={{ fontSize: '0.9em', color: '#060' }}>
          Tiles needed: {tilesNeeded.map((t) => tileToCode(t)).join(', ')}
        </div>
      ) : null}
    </div>
  );
}

export function HintPanel() {
  const hint = useHint();
  const enabled = (import.meta.env.VITE_ENABLE_HINTS ?? 'true') === 'true';

  if (!enabled) return null;

  return <SingleHint hint={hint} />;
}

export function MultiHintPanel() {
  const hintsBySource = useHintsBySource();
  const enabled = (import.meta.env.VITE_ENABLE_HINTS ?? 'true') === 'true';

  if (!enabled) return null;

  const beginnerHint = hintsBySource.Beginner ?? null;
  const intermediateHint = hintsBySource.Intermediate ?? null;
  const expertHint = hintsBySource.Expert ?? null;

  // Only show if we have at least one hint
  if (!beginnerHint && !intermediateHint && !expertHint) return null;

  return (
    <div>
      <h3 style={{ marginTop: 12, marginBottom: 8 }}>Hint Comparison (Testing)</h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 8,
        }}
      >
        <SingleHint hint={beginnerHint} label="Beginner" />
        <SingleHint hint={intermediateHint} label="Intermediate" />
        <SingleHint hint={expertHint} label="Expert" />
      </div>
    </div>
  );
}
