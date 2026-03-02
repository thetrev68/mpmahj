import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { useGameUIStore } from '@/stores/gameUIStore';

// Cleanup after each test
afterEach(() => {
  cleanup();

  // Reset the game UI store so Zustand state does not leak between tests.
  // PlayingPhase bridge effects read from the store on mount; a stale store
  // would cause incorrect initial renders in subsequent tests.
  useGameUIStore.getState().reset();

  // Clean up any Radix UI portals that might persist
  // Radix UI Dialog creates portal containers that can accumulate between tests
  const portals = document.querySelectorAll('[data-radix-portal]');
  portals.forEach((portal) => portal.remove());

  // Also clean up any other portal-like containers
  const portalContainers = document.querySelectorAll('[data-radix-popper-content-wrapper]');
  portalContainers.forEach((container) => container.remove());

  // Clean up any remaining modal backdrops or overlays
  const overlays = document.querySelectorAll('[data-state="open"]');
  overlays.forEach((overlay) => overlay.remove());
});

// Mock matchMedia (not available in jsdom)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {}, // deprecated
    removeListener: () => {}, // deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock ResizeObserver (not available in jsdom)
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
