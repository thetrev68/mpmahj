import React from 'react';
import { describe, expect, test } from 'vitest';
import { renderWithProviders, screen } from './test-utils';

/**
 * Verify React Testing Library integration
 */
describe('React Testing Library Integration', () => {
  test('renders a simple component', () => {
    const TestComponent = () => <div>Test Component</div>;

    renderWithProviders(<TestComponent />);

    expect(screen.getByText('Test Component')).toBeInTheDocument();
  });

  test('handles user interactions', async () => {
    const TestButton = () => {
      const [count, setCount] = React.useState(0);
      return <button onClick={() => setCount(count + 1)}>Count: {count}</button>;
    };

    const { user } = renderWithProviders(<TestButton />);

    expect(screen.getByText('Count: 0')).toBeInTheDocument();

    await user.click(screen.getByRole('button'));

    expect(screen.getByText('Count: 1')).toBeInTheDocument();
  });

  test('supports accessibility queries', () => {
    const TestForm = () => (
      <form>
        <label htmlFor="test-input">Test Input</label>
        <input id="test-input" type="text" />
        <button type="submit">Submit</button>
      </form>
    );

    renderWithProviders(<TestForm />);

    expect(screen.getByLabelText('Test Input')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
  });
});
