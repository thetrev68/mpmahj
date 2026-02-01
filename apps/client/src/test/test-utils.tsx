import { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * Custom render function that wraps components with common providers
 *
 * Usage:
 * ```tsx
 * import { renderWithProviders } from '@/test/test-utils';
 *
 * test('renders component', () => {
 *   const { getByText } = renderWithProviders(<MyComponent />);
 *   expect(getByText('Hello')).toBeInTheDocument();
 * });
 * ```
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  // Wrapper component for providers (add as needed)
  const Wrapper = ({ children }: { children: ReactNode }) => {
    return <>{children}</>;
  };

  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper: Wrapper, ...options }),
  };
}

/**
 * Re-export everything from React Testing Library for convenience
 */
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
