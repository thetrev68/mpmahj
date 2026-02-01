# Client Archive - 2026-01-31

This directory contains the **archived original frontend implementation** before the shadcn/ui refactor.

## Why This Archive Exists

On 2026-01-31, we decided to start fresh with a simplified component architecture:
- **Old approach**: 153 custom components (~61,200 lines estimated)
- **New approach**: 42 game-specific components + shadcn/ui (~3,900 lines estimated)
- **Result**: 93% reduction in component complexity

## What's Archived Here

This is a **complete snapshot** of the `apps/client` directory, including:
- All React components (`src/components/`)
- Custom hooks (`src/hooks/`)
- Zustand stores (`src/store/`)
- Utilities (`src/utils/`)
- Original styling (`src/App.css`, etc.)
- Supabase integration (`src/supabase.ts`)

## How to Reference

If you need to reference the old implementation:
1. **Don't copy code directly** - it's not compatible with the new architecture
2. **Use as inspiration** - logic and patterns can be adapted
3. **Check implementations** - see how features were previously built

## New Implementation

The active frontend is in `apps/client/` with:
- **shadcn/ui** for generic UI components (Button, Input, Dialog, etc.)
- **Tailwind CSS** for styling
- **Simplified architecture** focusing on game-specific components only
- **Component specs** in `docs/implementation/frontend/component-specs/`

## Key Differences

| Aspect | Old (Archived) | New (Active) |
|--------|----------------|--------------|
| UI Library | Custom components | shadcn/ui + Radix UI |
| Styling | Mix of CSS files | Tailwind CSS |
| Component Count | ~153 planned | 42 game-specific |
| Spec Length | 700+ lines each | 50-150 lines each |
| Complexity | High | Low |

---

**Archive Date**: 2026-01-31
**Reason**: Simplification and shadcn/ui integration
**Status**: Reference only - do not use in active development
