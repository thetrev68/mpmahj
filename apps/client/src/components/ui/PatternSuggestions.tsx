import { useBestPatterns } from '@/store/analysisStore';

function formatPct(n: number | undefined): string {
  if (typeof n !== 'number') return '—';
  return `${Math.round(n * 100)}%`;
}

export function PatternSuggestions() {
  const patterns = useBestPatterns();
  const enabled = (import.meta.env.VITE_ENABLE_HINTS ?? 'true') === 'true';
  const items = patterns.slice(0, 5); // keep small

  if (!enabled || !items.length) return null;

  return (
    <div style={{ marginTop: 8, marginBottom: 8, padding: 8, border: '1px solid #ddd' }}>
      <div>
        <strong>Patterns to consider</strong>
      </div>
      <ul style={{ marginTop: 6 }}>
        {items.map((p) => (
          <li key={`${p.pattern_id}-${p.variation_id}`} style={{ fontSize: '0.9em' }}>
            {p.pattern_name || p.pattern_id} — dist {p.distance} — prob {formatPct(p.probability)} —
            score {p.score}
          </li>
        ))}
      </ul>
    </div>
  );
}
