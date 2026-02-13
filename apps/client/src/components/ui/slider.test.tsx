import { render, screen } from '@testing-library/react';
import { Slider } from './slider';

describe('Slider', () => {
  it('renders slider with provided aria-label', () => {
    render(<Slider defaultValue={[2]} max={4} step={1} aria-label="Example slider" />);
    expect(screen.getByRole('slider')).toBeInTheDocument();
  });
});
