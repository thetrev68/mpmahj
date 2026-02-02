/**
 * Smoke tests to verify test infrastructure is working correctly
 */
describe('Test Infrastructure', () => {
  test('vitest is configured correctly', () => {
    expect(true).toBe(true);
  });

  test('jest-dom matchers are available', () => {
    const element = document.createElement('div');
    element.textContent = 'Hello, World!';
    document.body.appendChild(element);

    expect(element).toBeInTheDocument();
    expect(element).toHaveTextContent('Hello, World!');

    document.body.removeChild(element);
  });

  test('jsdom environment is working', () => {
    expect(window).toBeDefined();
    expect(document).toBeDefined();
    expect(document.createElement).toBeDefined();
  });

  test('globals are configured', () => {
    // These should be available without explicit imports due to vitest globals: true
    expect(describe).toBeDefined();
    expect(test).toBeDefined();
    expect(expect).toBeDefined();
  });
});
