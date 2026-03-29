import { useState } from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithProviders, screen } from '@/test/test-utils';
import { fixtures } from '@/test/fixtures';
import { RightRailHintSection } from './RightRailHintSection';
import { DEFAULT_HINT_SETTINGS, type HintSettings } from '@/lib/hintSettings';

const { baseHint, charlestonHint } = fixtures.hintData;

function createHintSettings(useHints = true): HintSettings {
  return {
    ...DEFAULT_HINT_SETTINGS,
    useHints,
  };
}

function renderSection(overrides: Partial<Parameters<typeof RightRailHintSection>[0]> = {}) {
  return renderWithProviders(
    <div
      data-testid="right-rail"
      className="right-rail hidden lg:flex lg:min-w-[var(--right-rail-w)] lg:flex-1 lg:flex-col lg:overflow-hidden lg:rounded-l-2xl lg:border-l lg:border-border/70 lg:bg-card dark:lg:bg-slate-950"
    >
      <div
        data-testid="right-rail-bottom"
        className="flex min-h-0 flex-1 flex-col bg-card p-4 dark:bg-slate-900"
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
          {...overrides}
        />
      </div>
    </div>
  );
}

function RightRailHintSectionHarness(
  props: Partial<Parameters<typeof RightRailHintSection>[0]> = {}
) {
  const [needsExtraVerticalSpace, setNeedsExtraVerticalSpace] = useState(false);

  return (
    <div
      data-testid="right-rail-bottom"
      data-hint-expanded={needsExtraVerticalSpace || undefined}
      className="flex min-h-0 flex-1 flex-col bg-card p-4 dark:bg-slate-900"
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
        onNeedsExtraVerticalSpace={setNeedsExtraVerticalSpace}
        {...props}
      />
    </div>
  );
}

describe('RightRailHintSection', () => {
  let resizeObserverCallback: ResizeObserverCallback | null = null;
  const resizeObserverObserve = vi.fn();
  const resizeObserverDisconnect = vi.fn();
  const originalResizeObserver = globalThis.ResizeObserver;

  beforeEach(() => {
    resizeObserverCallback = null;
    resizeObserverObserve.mockReset();
    resizeObserverDisconnect.mockReset();

    globalThis.ResizeObserver = class ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeObserverCallback = callback;
      }

      observe = resizeObserverObserve;
      disconnect = resizeObserverDisconnect;
      unobserve = vi.fn();
    };
  });

  afterEach(() => {
    if (originalResizeObserver === undefined) {
      Reflect.deleteProperty(globalThis, 'ResizeObserver');
      return;
    }

    globalThis.ResizeObserver = originalResizeObserver;
  });

  it('renders the hint section container with themed AI Hint heading', () => {
    renderSection();

    expect(screen.getByTestId('right-rail-hint-section')).toBeInTheDocument();
    expect(screen.getByTestId('right-rail-hint-section')).toHaveAttribute(
      'aria-label',
      'AI hint section'
    );
    expect(screen.getByRole('heading', { name: 'AI Hint' })).toHaveClass('text-foreground');
  });

  it('shows get hint when hints are enabled and idle', () => {
    renderSection();

    expect(screen.getByTestId('get-hint-button')).toBeInTheDocument();
    expect(screen.getByTestId('get-hint-button')).toHaveClass('bg-background', 'dark:bg-slate-950');
    expect(screen.queryByTestId('hint-panel')).not.toBeInTheDocument();
  });

  it('shows inline loading state with cancel control', () => {
    renderSection({ hintPending: true });

    expect(screen.getByTestId('hint-loading-inline')).toHaveClass(
      'border',
      'bg-card',
      'text-card-foreground',
      'dark:bg-slate-900'
    );
    expect(screen.getByTestId('hint-loading-inline')).not.toHaveClass(
      'border-slate-700',
      'bg-slate-900/60'
    );
    expect(screen.getByTestId('cancel-hint-request-button')).toBeInTheDocument();
    expect(screen.getByTestId('cancel-hint-request-button')).toHaveClass('text-muted-foreground');
    expect(screen.queryByTestId('hint-loading-overlay')).not.toBeInTheDocument();
  });

  it('shows inline error state with retry control', () => {
    renderSection({ hintError: 'Hint request timed out. Please try again.' });

    expect(screen.getByTestId('hint-error-inline')).toHaveTextContent(/timed out/i);
    expect(screen.getByTestId('hint-error-inline')).toHaveClass('text-destructive');
    expect(screen.getByTestId('retry-hint-button')).toBeInTheDocument();
  });

  it('renders the hint panel inside the rail when a hint is available', () => {
    renderSection({ currentHint: baseHint });

    expect(screen.getByTestId('hint-panel')).toBeInTheDocument();
    expect(screen.getByTestId('hint-panel')).not.toHaveClass('fixed');
    expect(screen.getByTestId('hint-best-patterns')).toBeInTheDocument();
    expect(screen.getByText('Consecutive Run')).toBeInTheDocument();
    expect(screen.getByTestId('get-new-hint-button')).toBeInTheDocument();
    expect(screen.queryByTestId('right-rail-top')).not.toBeInTheDocument();
  });

  it('renders Charleston pass recommendations and pattern section when the hint payload includes them', () => {
    renderSection({ currentHint: charlestonHint });

    expect(screen.getByTestId('hint-panel')).toBeInTheDocument();
    expect(screen.getByTestId('hint-charleston-pass-recommendations')).toBeInTheDocument();
    expect(screen.getByText(/recommended pass/i)).toBeInTheDocument();
    expect(screen.queryByText(/recommended discard/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('hint-best-patterns')).toBeInTheDocument();
    expect(screen.getByText('Consecutive Run')).toBeInTheDocument();
  });

  it('shows hints off notice and no trigger when hints are disabled', () => {
    renderSection({
      hintSettings: createHintSettings(false),
      canRequestHint: false,
    });

    expect(screen.getByTestId('hints-off-notice')).toBeInTheDocument();
    expect(screen.getByTestId('hints-off-notice')).toHaveClass('text-muted-foreground');
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
    expect(screen.getByText('AI Hint')).toHaveClass('text-foreground');
  });

  it('fires extra-space callback and sets expanded state when hint content overflows', () => {
    const onNeedsExtraVerticalSpace = vi.fn();
    renderSection({
      currentHint: baseHint,
      onNeedsExtraVerticalSpace,
    });

    const body = screen.getByTestId('hint-panel').parentElement?.parentElement as HTMLDivElement;
    expect(body).toBeTruthy();

    Object.defineProperty(body, 'clientHeight', {
      configurable: true,
      value: 120,
    });
    Object.defineProperty(body, 'scrollHeight', {
      configurable: true,
      value: 180,
    });

    act(() => {
      resizeObserverCallback?.([], {} as ResizeObserver);
    });

    expect(onNeedsExtraVerticalSpace).toHaveBeenCalledWith(true);
  });

  it('clears extra-space state when no hint is active', () => {
    const { rerender } = renderWithProviders(
      <RightRailHintSectionHarness currentHint={baseHint} />
    );

    const body = screen.getByTestId('hint-panel').parentElement?.parentElement as HTMLDivElement;
    expect(body).toBeTruthy();

    Object.defineProperty(body, 'clientHeight', {
      configurable: true,
      value: 120,
    });
    Object.defineProperty(body, 'scrollHeight', {
      configurable: true,
      value: 180,
    });

    act(() => {
      resizeObserverCallback?.([], {} as ResizeObserver);
    });
    expect(screen.getByTestId('right-rail-bottom')).toHaveAttribute('data-hint-expanded', 'true');

    act(() => {
      rerender(<RightRailHintSectionHarness currentHint={null} />);
    });

    expect(screen.getByTestId('right-rail-bottom')).not.toHaveAttribute('data-hint-expanded');
  });
});
