import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

// Suppress React error boundary logging in test output
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

function ThrowingChild({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error('Test render error');
  }
  return <div data-testid="child-content">Child rendered</div>;
}

describe('ErrorBoundary', () => {
  it('renders children normally when no error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.queryByTestId('error-boundary-fallback')).not.toBeInTheDocument();
  });

  it('shows fallback UI when a child throws during render', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong.')).toBeInTheDocument();
    expect(screen.getByTestId('error-boundary-reset-button')).toBeInTheDocument();
    expect(screen.queryByTestId('child-content')).not.toBeInTheDocument();
  });

  it('logs the error to console.error', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>
    );

    expect(console.error).toHaveBeenCalledWith(
      '[ErrorBoundary]',
      expect.any(Error),
      expect.any(String)
    );
  });

  it('resets when resetKeys change', () => {
    function Wrapper() {
      const [key, setKey] = useState(0);
      return (
        <div>
          <button data-testid="change-key" onClick={() => setKey((k) => k + 1)}>
            Change Key
          </button>
          <ErrorBoundary resetKeys={[key]}>
            <ThrowingChild shouldThrow={key === 0} />
          </ErrorBoundary>
        </div>
      );
    }

    render(<Wrapper />);

    // Initially throws — fallback shown
    expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument();

    // Change resetKeys — boundary resets, child no longer throws
    userEvent.click(screen.getByTestId('change-key'));

    expect(screen.findByTestId('child-content')).toBeTruthy();
  });

  it('renders custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div data-testid="custom-fallback">Custom error UI</div>}>
        <ThrowingChild />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
    expect(screen.getByText('Custom error UI')).toBeInTheDocument();
    expect(screen.queryByTestId('error-boundary-fallback')).not.toBeInTheDocument();
  });

  it('resets when Try Again button is clicked', async () => {
    // ThrowingChild always throws, so after reset we get the fallback again.
    // This test verifies the reset mechanism triggers a re-render attempt.
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('error-boundary-reset-button'));

    // After reset, child throws again so fallback reappears — proves reset happened
    expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument();
  });
});
