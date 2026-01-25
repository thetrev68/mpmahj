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
import type { EventCategory } from '@/utils/eventFormatter';
import type { Seat } from '@/types/bindings/generated/Seat';

interface EventLogEntry {
  id: string;
  message: string;
  timestamp: number;
  category: EventCategory;
}

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

  // Joker exchange dialog state
  showJokerExchangeDialog: boolean;
  jokerExchangeTarget: { seat: Seat; meldIndex: number } | null;
  setJokerExchangeDialog: (show: boolean, target?: { seat: Seat; meldIndex: number }) => void;

  // Meld upgrade dialog state
  showMeldUpgradeDialog: boolean;
  meldUpgradeIndex: number | null;
  setMeldUpgradeDialog: (show: boolean, meldIndex?: number) => void;

  // Courtesy pass negotiation state
  showCourtesyPassDialog: boolean;
  courtesyPassProposal: number | null; // Our proposal (0-3 or null if not proposed)
  partnerCourtesyProposal: number | null; // Partner's proposal
  courtesyPassAgreedCount: number | null; // Agreed count after negotiation
  setCourtesyPassDialog: (show: boolean) => void;
  setCourtesyPassProposal: (count: number | null) => void;
  setPartnerCourtesyProposal: (count: number | null) => void;
  setCourtesyPassAgreedCount: (count: number | null) => void;
  resetCourtesyPassState: () => void;

  // Blank exchange dialog state
  showBlankExchangeDialog: boolean;
  setBlankExchangeDialog: (show: boolean) => void;

  // Error/notification toasts
  errors: Array<{ id: string; message: string; timestamp: number }>;
  addError: (message: string) => void;
  removeError: (id: string) => void;
  clearErrors: () => void;

  // Animation settings
  animationsEnabled: boolean;
  setAnimationsEnabled: (enabled: boolean) => void;

  // Event log
  eventLog: EventLogEntry[];
  maxEventLogSize: number;
  addEvent: (message: string, category?: EventCategory) => void;
  clearEventLog: () => void;
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

  // ===== EVENT LOG =====

  eventLog: [],
  maxEventLogSize: 50,

  addEvent: (message: string, category: EventCategory = 'info') => {
    const id = `event-${Date.now()}-${Math.random()}`;
    set((state) => {
      const newLog = [...state.eventLog, { id, message, timestamp: Date.now(), category }];
      // Keep only last N events
      if (newLog.length > state.maxEventLogSize) {
        return { eventLog: newLog.slice(-state.maxEventLogSize) };
      }
      return { eventLog: newLog };
    });
  },

  clearEventLog: () => {
    set({ eventLog: [] });
  },

  // ===== JOKER EXCHANGE DIALOG =====

  showJokerExchangeDialog: false,
  jokerExchangeTarget: null,

  setJokerExchangeDialog: (show: boolean, target?: { seat: Seat; meldIndex: number }) => {
    set({
      showJokerExchangeDialog: show,
      jokerExchangeTarget: target ?? null,
    });
  },

  // ===== MELD UPGRADE DIALOG =====

  showMeldUpgradeDialog: false,
  meldUpgradeIndex: null,

  setMeldUpgradeDialog: (show: boolean, meldIndex?: number) => {
    set({
      showMeldUpgradeDialog: show,
      meldUpgradeIndex: meldIndex ?? null,
    });
  },

  // ===== COURTESY PASS NEGOTIATION =====

  showCourtesyPassDialog: false,
  courtesyPassProposal: null,
  partnerCourtesyProposal: null,
  courtesyPassAgreedCount: null,

  setCourtesyPassDialog: (show: boolean) => {
    set({ showCourtesyPassDialog: show });
  },

  setCourtesyPassProposal: (count: number | null) => {
    set({ courtesyPassProposal: count });
  },

  setPartnerCourtesyProposal: (count: number | null) => {
    set({ partnerCourtesyProposal: count });
  },

  setCourtesyPassAgreedCount: (count: number | null) => {
    set({ courtesyPassAgreedCount: count });
  },

  resetCourtesyPassState: () => {
    set({
      courtesyPassProposal: null,
      partnerCourtesyProposal: null,
      courtesyPassAgreedCount: null,
      showCourtesyPassDialog: false,
    });
  },

  // ===== BLANK EXCHANGE DIALOG =====

  showBlankExchangeDialog: false,

  setBlankExchangeDialog: (show: boolean) => {
    set({ showBlankExchangeDialog: show });
  },
}));
