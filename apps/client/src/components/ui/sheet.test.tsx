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

  it('uses theme-aware surface classes instead of hardcoded dark palette classes', () => {
    renderWithProviders(
      <Sheet open={true} onOpenChange={vi.fn()}>
        <SheetContent side="right">
          <SheetTitle>Test Sheet</SheetTitle>
          <SheetDescription>Sheet description</SheetDescription>
        </SheetContent>
      </Sheet>
    );

    const dialog = screen.getByRole('dialog', { name: /test sheet/i });
    expect(dialog).toHaveClass('bg-background', 'text-foreground', 'border-border');
    expect(dialog).not.toHaveClass('bg-slate-900', 'text-slate-100', 'border-slate-700');
    expect(screen.getByText('Sheet description')).toHaveClass('text-muted-foreground');
    expect(screen.getByText('Sheet description')).not.toHaveClass('text-slate-300');
  });
});
