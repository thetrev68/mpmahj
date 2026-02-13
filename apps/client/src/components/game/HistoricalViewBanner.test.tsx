import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { HistoricalViewBanner } from './HistoricalViewBanner';

describe('HistoricalViewBanner', () => {
  it('renders move details and return button', () => {
    renderWithProviders(
      <HistoricalViewBanner
        moveNumber={42}
        moveDescription="South discarded 5 Dots"
        isGameOver={false}
        canResume={false}
        onReturnToPresent={vi.fn()}
        onResumeFromHere={vi.fn()}
      />
    );

    expect(screen.getByTestId('historical-view-banner')).toBeInTheDocument();
    expect(screen.getByText(/VIEWING HISTORY - Move #42/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /return to current/i })).toBeInTheDocument();
  });

  it('shows resume button only when allowed', () => {
    const { rerender } = renderWithProviders(
      <HistoricalViewBanner
        moveNumber={12}
        moveDescription="Move"
        isGameOver={false}
        canResume={false}
        onReturnToPresent={vi.fn()}
        onResumeFromHere={vi.fn()}
      />
    );

    expect(screen.queryByTestId('resume-from-here-button')).not.toBeInTheDocument();

    rerender(
      <HistoricalViewBanner
        moveNumber={12}
        moveDescription="Move"
        isGameOver={false}
        canResume={true}
        onReturnToPresent={vi.fn()}
        onResumeFromHere={vi.fn()}
      />
    );

    expect(screen.getByTestId('resume-from-here-button')).toBeInTheDocument();
  });
});
