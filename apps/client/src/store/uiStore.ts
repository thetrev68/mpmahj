/**
 * UI State Store
 *
 * Volatile client-side UI state that doesn't affect game logic.
 * This includes selections, drag state, UI modals, sorting preferences, etc.
 *
 * Unlike gameStore, this can be mutated directly from UI interactions.
 */

import { create } from 'zustand';
import type { Tile } from '@/types/bindings';

interface UIState {
  // Tile selection (for Charleston passes, discards, etc.)
  selectedTiles: Set<string>; // Set of tile keys
  toggleTileSelection: (key: string) => void;
  clearSelection: () => void;
  selectTiles: (keys: string[]) => void;
  isSelected: (key: string) => boolean;

  // Drag and drop
  draggedTile: Tile | null;
  isDragging: boolean;
  setDraggedTile: (tile: Tile | null) => void;

  // Hover state
  hoveredTile: string | null;
  setHoveredTile: (key: string | null) => void;

  // Card viewer
  showCardViewer: boolean;
  setShowCardViewer: (show: boolean) => void;

  // Hand sorting
  sortingMode: 'suit' | 'rank';
  setSortingMode: (mode: 'suit' | 'rank') => void;

  // Charleston UI state
  charlestonTimer: number | null;
  setCharlestonTimer: (seconds: number | null) => void;

  // Call window state
  showCallWindow: boolean;
  callWindowTile: Tile | null;
  setCallWindow: (show: boolean, tile?: Tile) => void;

  // Error/notification toasts
  errors: Array<{ id: string; message: string; timestamp: number }>;
  addError: (message: string) => void;
  removeError: (id: string) => void;
  clearErrors: () => void;

  // Animation settings
  animationsEnabled: boolean;
  setAnimationsEnabled: (enabled: boolean) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  // ===== TILE SELECTION =====

  selectedTiles: new Set<string>(),

  toggleTileSelection: (key: string) => {
    set((state) => {
      const newSelected = new Set(state.selectedTiles);
      if (newSelected.has(key)) {
        newSelected.delete(key);
      } else {
        newSelected.add(key);
      }
      return { selectedTiles: newSelected };
    });
  },

  clearSelection: () => {
    set({ selectedTiles: new Set() });
  },

  selectTiles: (keys: string[]) => {
    set({ selectedTiles: new Set(keys) });
  },

  isSelected: (key: string) => {
    return get().selectedTiles.has(key);
  },

  // ===== DRAG AND DROP =====

  draggedTile: null,
  isDragging: false,

  setDraggedTile: (tile: Tile | null) => {
    set({
      draggedTile: tile,
      isDragging: tile !== null,
    });
  },

  // ===== HOVER STATE =====

  hoveredTile: null,

  setHoveredTile: (key: string | null) => {
    set({ hoveredTile: key });
  },

  // ===== CARD VIEWER =====

  showCardViewer: false,

  setShowCardViewer: (show: boolean) => {
    set({ showCardViewer: show });
  },

  // ===== HAND SORTING =====

  sortingMode: 'suit',

  setSortingMode: (mode: 'suit' | 'rank') => {
    set({ sortingMode: mode });
  },

  // ===== CHARLESTON UI =====

  charlestonTimer: null,

  // TODO: Wire timer events (CharlestonTimerStarted, CallWindowOpened/Closed) and honor TimerMode::Hidden.
  setCharlestonTimer: (seconds: number | null) => {
    set({ charlestonTimer: seconds });
  },

  // ===== CALL WINDOW =====

  showCallWindow: false,
  callWindowTile: null,

  setCallWindow: (show: boolean, tile?: Tile) => {
    set({
      showCallWindow: show,
      callWindowTile: tile ?? null,
    });
  },

  // ===== ERRORS/NOTIFICATIONS =====

  errors: [],

  addError: (message: string) => {
    const id = `error-${Date.now()}-${Math.random()}`;
    set((state) => ({
      errors: [
        ...state.errors,
        {
          id,
          message,
          timestamp: Date.now(),
        },
      ],
    }));

    // Auto-remove after 5 seconds
    setTimeout(() => {
      get().removeError(id);
    }, 5000);
  },

  removeError: (id: string) => {
    set((state) => ({
      errors: state.errors.filter((e) => e.id !== id),
    }));
  },

  clearErrors: () => {
    set({ errors: [] });
  },

  // ===== ANIMATION SETTINGS =====

  animationsEnabled: true,

  setAnimationsEnabled: (enabled: boolean) => {
    set({ animationsEnabled: enabled });
  },
}));
