import { useMemo } from 'react';
import { useHint, useHintsBySource } from '@/store/analysisStore';
import { useGameStore } from '@/store/gameStore';
import { tileToCode } from '@/utils/tileFormatter';
import type { HintData } from '@/types/bindings/generated/HintData';

interface SingleHintProps {
  hint: HintData | null;
  label?: string;
  verbosity?: 'Beginner' | 'Intermediate' | 'Expert';
}

function SingleHint({ hint, label, verbosity = 'Beginner' }: SingleHintProps) {
  const phase = useGameStore((state) => state.phase);
  const discard = hint?.recommended_discard ?? null;
  const distance = hint?.distance_to_win;
  const tilesNeeded = hint?.tiles_needed_for_win ?? [];
  const bestPatterns = hint?.best_patterns ?? [];
  const charlestonRecs = hint?.charleston_pass_recommendations ?? [];

  const discardLabel = useMemo(() => (discard != null ? tileToCode(discard) : '—'), [discard]);
  const charlestonTiles = useMemo(
    () => (charlestonRecs.length > 0 ? charlestonRecs.map((t) => tileToCode(t)).join(', ') : '—'),
    [charlestonRecs]
  );

  // Check if in Charleston phase
  const isCharleston = typeof phase === 'object' && phase !== null && 'Charleston' in phase;

  if (!hint) return null;

  // Expert shows nothing
  if (verbosity === 'Expert') {
    return (
      <div style={{ marginTop: 8, marginBottom: 8, padding: 8, border: '1px solid #ddd' }}>
        {label ? <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{label}</div> : null}
        <div style={{ fontSize: '0.9em', color: '#888', fontStyle: 'italic' }}>
          Visual hints only (no text)
        </div>
      </div>
    );
  }

  // Intermediate shows discard only
  if (verbosity === 'Intermediate') {
    return (
      <div style={{ marginTop: 8, marginBottom: 8, padding: 8, border: '1px solid #ddd' }}>
        {label ? <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{label}</div> : null}
        <div>
          {isCharleston ? (
            <>
              <strong>Charleston:</strong> {charlestonTiles}
            </>
          ) : (
            <>
              <strong>Discard:</strong> {discardLabel}
            </>
          )}
        </div>
      </div>
    );
  }

  // Beginner shows discard + reason + best pattern
  return (
    <div style={{ marginTop: 8, marginBottom: 8, padding: 8, border: '1px solid #ddd' }}>
      {label ? <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{label}</div> : null}
      <div>
        {isCharleston ? (
          <>
            <strong>Charleston Pass:</strong> {charlestonTiles}
          </>
        ) : (
          <>
            <strong>Recommended Discard:</strong> {discardLabel}
          </>
        )}
      </div>
      {!isCharleston && hint?.discard_reason ? (
        <div style={{ fontSize: '0.9em', color: '#555', marginTop: 4 }}>{hint.discard_reason}</div>
      ) : null}
      {bestPatterns.length > 0 ? (
        <div style={{ marginTop: 8, fontSize: '0.9em' }}>
          <strong>Best Pattern:</strong> {bestPatterns[0].pattern_name} (
          {Math.round(bestPatterns[0].probability * 100)}% chance, score: {bestPatterns[0].score})
        </div>
      ) : null}
      {!isCharleston && hint?.hot_hand ? (
        <div style={{ color: '#b00', marginTop: 4 }}>🔥 Hot hand!</div>
      ) : null}
      {!isCharleston && typeof distance === 'number' && distance < 14 ? (
        <div style={{ fontSize: '0.9em', marginTop: 4 }}>Distance to win: {distance}</div>
      ) : null}
      {!isCharleston && tilesNeeded.length > 0 ? (
        <div style={{ fontSize: '0.9em', color: '#060', marginTop: 4 }}>
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

// IMPORTANT: This is a TEMPORARY DIAGNOSTIC TOOL for comparing AI recommendations.
//
// This 3-box view shows what different AI ENGINES recommend (not verbosity levels):
// - Box 1: BasicBot AI (simple heuristics)
// - Box 2: Greedy AI (pattern-focused)
// - Box 3: MCTS AI (Monte Carlo Tree Search - best quality)
//
// DO NOT CONFUSE with HintVerbosity (Beginner/Intermediate/Expert):
// - HintVerbosity controls DISPLAY DETAIL for human players (all get MCTS recommendations)
// - This diagnostic view compares DIFFERENT AI ENGINES to validate backend logic
//
// The final production UI will use proper verbosity-based display.
// This is only for developer testing/debugging.
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
      <h3 style={{ marginTop: 12, marginBottom: 8 }}>AI Comparison (Diagnostic Tool)</h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 8,
        }}
      >
        <SingleHint hint={beginnerHint} label="BasicBot" verbosity="Beginner" />
        <SingleHint hint={intermediateHint} label="Greedy" verbosity="Intermediate" />
        <SingleHint hint={expertHint} label="MCTS" verbosity="Expert" />
      </div>
    </div>
  );
}
