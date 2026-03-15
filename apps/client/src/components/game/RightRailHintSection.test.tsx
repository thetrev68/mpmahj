import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { RightRailHintSection } from './RightRailHintSection';
import { DEFAULT_HINT_SETTINGS, type HintSettings } from '@/lib/hintSettings';
import type { HintData } from '@/types/bindings/generated/HintData';
import type { HintVerbosity } from '@/types/bindings/generated/HintVerbosity';

const baseHint: HintData = {
  recommended_discard: 10,
  discard_reason: 'Keeps more pattern options open',
  best_patterns: [
    {
      pattern_id: 'p1',
      variation_id: 'v1',
      pattern_name: 'Consecutive Run',
      probability: 0.62,
      score: 30,
      distance: 3,
    },
  ],
  tiles_needed_for_win: [],
  distance_to_win: 3,
  hot_hand: false,
  call_opportunities: [],
  defensive_hints: [],
  charleston_pass_recommendations: [],
  tile_scores: { 10: 2.2, 11: 1.4 },
  utility_scores: { 10: 0.8, 12: 0.3 },
};

function createHintSettings(verbosity: HintVerbosity = 'Beginner'): HintSettings {
  return {
    ...DEFAULT_HINT_SETTINGS,
    verbosity,
  };
}

function renderSection(overrides: Partial<Parameters<typeof RightRailHintSection>[0]> = {}) {
  return renderWithProviders(
    <div
      data-testid="right-rail"
      className="right-rail hidden w-64 flex-shrink-0 lg:flex lg:flex-col lg:rounded-lg lg:bg-slate-800"
    >
      <div data-testid="right-rail-top" className="flex-1" />
      <div
        data-testid="right-rail-bottom"
        className="flex-1 flex flex-col border-t border-slate-600 p-3"
      >
        <RightRailHintSection
          canRequestHint={true}
          currentHint={null}
          hintPending={false}
          hintError={null}
          hintSettings={createHintSettings()}
          isHistoricalView={false}
          openHintRequestDialog={vi.fn()}
          cancelHintRequest={vi.fn()}
          requestVerbosity="Beginner"
          {...overrides}
        />
      </div>
    </div>
  );
}

describe('RightRailHintSection', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the hint section in the rail bottom pane and leaves the top pane empty', () => {
    renderSection();

    expect(screen.getByTestId('right-rail-hint-section')).toBeInTheDocument();
    expect(screen.getByTestId('right-rail-top')).toBeEmptyDOMElement();
  });

  it('shows get hint when hints are enabled and idle', () => {
    renderSection();

    expect(screen.getByTestId('get-hint-button')).toBeInTheDocument();
    expect(screen.queryByTestId('hint-panel')).not.toBeInTheDocument();
  });

  it('shows inline loading state with cancel control', () => {
    renderSection({ hintPending: true });

    expect(screen.getByTestId('hint-loading-inline')).toBeInTheDocument();
    expect(screen.getByTestId('cancel-hint-request-button')).toBeInTheDocument();
    expect(screen.queryByTestId('hint-loading-overlay')).not.toBeInTheDocument();
  });

  it('shows inline error state with retry control', () => {
    renderSection({ hintError: 'Hint request timed out. Please try again.' });

    expect(screen.getByTestId('hint-error-inline')).toHaveTextContent(/timed out/i);
    expect(screen.getByTestId('retry-hint-button')).toBeInTheDocument();
  });

  it('renders the hint panel inside the rail when a hint is available', () => {
    renderSection({ currentHint: baseHint });

    expect(screen.getByTestId('hint-panel')).toBeInTheDocument();
    expect(screen.getByTestId('hint-panel')).not.toHaveClass('fixed');
    expect(screen.queryByTestId('hint-discard-reason')).not.toBeInTheDocument();
    expect(screen.getByTestId('get-new-hint-button')).toBeInTheDocument();
  });

  it('shows hints off notice and no trigger when hints are disabled', () => {
    renderSection({
      hintSettings: createHintSettings('Disabled'),
      canRequestHint: false,
    });

    expect(screen.getByTestId('hints-off-notice')).toBeInTheDocument();
    expect(screen.queryByTestId('get-hint-button')).not.toBeInTheDocument();
  });

  it('hides request triggers in historical view while preserving an existing hint', () => {
    renderSection({
      canRequestHint: false,
      currentHint: baseHint,
      isHistoricalView: true,
    });

    expect(screen.getByTestId('hint-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('get-hint-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('get-new-hint-button')).not.toBeInTheDocument();
  });
});
