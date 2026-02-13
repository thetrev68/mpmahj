import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';

describe('Sheet', () => {
  it('renders right-side sheet content when open', () => {
    renderWithProviders(
      <Sheet open={true} onOpenChange={vi.fn()}>
        <SheetContent side="right">
          <SheetTitle>Test Sheet</SheetTitle>
          <SheetDescription>Sheet description</SheetDescription>
        </SheetContent>
      </Sheet>
    );

    expect(screen.getByRole('dialog', { name: /test sheet/i })).toBeInTheDocument();
    expect(screen.getByText('Test Sheet')).toBeInTheDocument();
  });
});
