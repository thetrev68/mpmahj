/**
 * Integration Tests for VR-013: Charleston Direction Banner + Release Hardening
 *
 * Verifies:
 * - T-1: IncomingTilesStaged private event does NOT show the direction banner (AC-1, AC-2)
 * - T-2: TilesPassing public event shows the direction banner with correct text/aria (AC-1, AC-3, AC-4)
 * - T-3: Bot-involved Charleston flow advances without UI stalls (AC-5)
 * - T-4: Reconnect during blind staging restores coherent UI state without duplication (AC-6)
 *
 * Connection points confirmed as already correct (no code changes):
 *   - publicEventHandlers.charleston.ts handleTilesPassing → SET_PASS_DIRECTION only on TilesPassing
 *   - privateEventHandlers.ts handleIncomingTilesStaged → no SET_PASS_DIRECTION dispatch
 *   - CharlestonPhase.tsx SET_STAGED_INCOMING → SET (not additive), prevents reconnect duplication
 *   - PassAnimationLayer.tsx → aria-live="polite" already present
 *
 * AC-7 Regression gates — run before each release:
 *   npx vitest run
 *   npx tsc --noEmit
 *   npm run check:all
 */

import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import { createMockWebSocket, type MockWebSocket } from '@/test/mocks/websocket';
import { gameStates } from '@/test/fixtures';
import { GameBoard } from '@/components/game/GameBoard';
import type { PublicEvent } from '@/types/bindings/generated/PublicEvent';
import type { PrivateEvent } from '@/types/bindings/generated/PrivateEvent';

type WebSocketCtor = new (url: string) => WebSocket;

function setupWebSocketMock() {
  const instances: MockWebSocket[] = [];

  const WebSocketMock = vi.fn(function (this: WebSocket, url: string) {
    const ws = createMockWebSocket(url);
    instances.push(ws);
    return ws as unknown as WebSocket;
  }) as unknown as WebSocketCtor;

  Object.assign(WebSocketMock, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });

  // @ts-expect-error test override
  global.WebSocket = WebSocketMock;
  // @ts-expect-error test override
  window.WebSocket = WebSocketMock;

  return { instances };
}

describe('VR-013: Charleston Direction Banner + Release Hardening', () => {
  let mockWs: ReturnType<typeof createMockWebSocket>;

  const sendPublic = async (event: PublicEvent) => {
    await act(async () => {
      mockWs.triggerMessage(
        JSON.stringify({ kind: 'Event', payload: { event: { Public: event } } })
      );
    });
  };

  const sendPrivate = async (event: PrivateEvent) => {
    await act(async () => {
      mockWs.triggerMessage(
        JSON.stringify({ kind: 'Event', payload: { event: { Private: event } } })
      );
    });
  };

  beforeEach(() => {
    mockWs = createMockWebSocket();
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // T-1: IncomingTilesStaged does NOT trigger the direction banner
  // ---------------------------------------------------------------------------
  describe('T-1: IncomingTilesStaged does not show direction banner', () => {
    test('direction banner is absent after IncomingTilesStaged private event arrives', async () => {
      renderWithProviders(<GameBoard initialState={gameStates.charlestonFirstLeft} ws={mockWs} />);

      await sendPrivate({
        IncomingTilesStaged: {
          player: 'South',
          tiles: [3, 14],
          from: null,
          context: 'Charleston',
        },
      });

      // Banner must NOT appear for an incoming staging event
      expect(screen.queryByTestId('pass-animation-layer')).not.toBeInTheDocument();

      // The incoming tiles are visible in the staging strip (verifies the event was processed)
      expect(
        screen.getByTestId('staging-incoming-tile-incoming-FirstLeft-0-3')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('staging-incoming-tile-incoming-FirstLeft-1-14')
      ).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // T-2: TilesPassing public event opens the direction banner
  // ---------------------------------------------------------------------------
  describe('T-2: TilesPassing shows direction banner with correct content', () => {
    test('pass-animation-layer appears with correct direction text on TilesPassing Right', async () => {
      renderWithProviders(<GameBoard initialState={gameStates.charlestonFirstRight} ws={mockWs} />);

      await sendPublic({ TilesPassing: { direction: 'Right' } });

      const banner = screen.getByTestId('pass-animation-layer');
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveTextContent(/Passing Right/i);
    });

    test('direction banner carries aria-live="polite" for screen reader accessibility (AC-4)', async () => {
      renderWithProviders(<GameBoard initialState={gameStates.charlestonFirstLeft} ws={mockWs} />);

      await sendPublic({ TilesPassing: { direction: 'Left' } });

      expect(screen.getByTestId('pass-animation-layer')).toHaveAttribute('aria-live', 'polite');
    });

    test('TilesPassing Across shows correct label and animation class (AC-3, AC-4)', async () => {
      renderWithProviders(
        <GameBoard initialState={gameStates.charlestonFirstAcross} ws={mockWs} />
      );

      await sendPublic({ TilesPassing: { direction: 'Across' } });

      const banner = screen.getByTestId('pass-animation-layer');
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveTextContent(/Passing Across/i);
      // Animation hook class must be present on the card inside the banner
      expect(banner.querySelector('.pass-animation-card')).toBeInTheDocument();
    });

    test('IncomingTilesStaged before TilesPassing does not show banner early', async () => {
      renderWithProviders(<GameBoard initialState={gameStates.charlestonFirstLeft} ws={mockWs} />);

      // Blind incoming tiles arrive first
      await sendPrivate({
        IncomingTilesStaged: {
          player: 'South',
          tiles: [3, 14],
          from: null,
          context: 'Charleston',
        },
      });

      // Banner must still be absent
      expect(screen.queryByTestId('pass-animation-layer')).not.toBeInTheDocument();

      // Outgoing commit acknowledged — now the banner should appear
      await sendPublic({ TilesPassing: { direction: 'Left' } });

      expect(screen.getByTestId('pass-animation-layer')).toBeInTheDocument();
      expect(screen.getByTestId('pass-animation-layer')).toHaveTextContent(/Passing Left/i);
    });
  });

  // ---------------------------------------------------------------------------
  // T-3: Bot-involved Charleston flow — no UI stalls (AC-5)
  //
  // Drives the exact server event sequence produced by the bot path up to and
  // including TilesPassing. The terminal CharlestonPhaseChanged is intentionally
  // omitted — actual bot-runner progression is verified by server-side tests;
  // here we only confirm the UI handles bot-ready signals and the pass commit
  // without stalling, leaving it ready to accept the server's next event.
  // ---------------------------------------------------------------------------
  describe('T-3: Bot-involved Charleston flow advances without stalls', () => {
    test('bot PlayerReadyForPass events update ready count; TilesPassing then shows direction banner', async () => {
      // charlestonFirstLeft: West=bot, North=bot (your_seat=South)
      renderWithProviders(<GameBoard initialState={gameStates.charlestonFirstLeft} ws={mockWs} />);

      // Bots become ready
      await sendPublic({ PlayerReadyForPass: { player: 'West' } });
      await sendPublic({ PlayerReadyForPass: { player: 'North' } });

      await waitFor(() => {
        expect(screen.getByTestId('ready-count')).toHaveTextContent(/2\//);
      });

      // Server commits the pass for all players
      await sendPublic({ TilesPassing: { direction: 'Left' } });

      // Direction banner is shown — UI is not stalled waiting for bot-driven phase transition
      expect(screen.getByTestId('pass-animation-layer')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // T-4: Reconnect during blind staging — no duplicate tiles (AC-6)
  //
  // Simulates a real disconnect/reconnect/auth/snapshot/re-delivery cycle.
  // After reconnect, CharlestonPhase remounts (key changes on snapshotRevision
  // increment), clearing local staged-tile state. The server then re-delivers
  // IncomingTilesStaged. SET semantics must prevent duplication and the banner
  // must remain absent throughout.
  // ---------------------------------------------------------------------------
  describe('T-4: Reconnect during blind staging restores coherent UI state', () => {
    let savedWebSocket: typeof WebSocket;

    beforeEach(() => {
      vi.useFakeTimers();
      savedWebSocket = window.WebSocket;
      localStorage.clear();
    });

    afterEach(() => {
      vi.useRealTimers();
      // @ts-expect-error restore test override
      global.WebSocket = savedWebSocket;
      window.WebSocket = savedWebSocket;
      localStorage.clear();
    });

    test('staged tiles are restored without duplication after disconnect and reconnect', () => {
      const { instances } = setupWebSocketMock();

      // Render without ws prop — GameBoard creates its own socket via global.WebSocket
      renderWithProviders(<GameBoard initialState={gameStates.charlestonFirstLeft} />);

      const firstSocket = instances[0];

      act(() => {
        firstSocket.triggerOpen();
        firstSocket.triggerMessage({
          kind: 'AuthSuccess',
          payload: {
            player_id: 'player-south',
            display_name: 'SouthPlayer',
            session_token: 'session-token-initial',
            seat: 'South',
          },
        });
      });

      // Initial delivery of incoming staged tiles
      act(() => {
        firstSocket.triggerMessage({
          kind: 'Event',
          payload: {
            event: {
              Private: {
                IncomingTilesStaged: {
                  player: 'South',
                  tiles: [3, 14],
                  from: null,
                  context: 'Charleston',
                },
              },
            },
          },
        });
      });

      expect(
        screen.getByTestId('staging-incoming-tile-incoming-FirstLeft-0-3')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('staging-incoming-tile-incoming-FirstLeft-1-14')
      ).toBeInTheDocument();

      // Disconnect
      act(() => {
        firstSocket.triggerClose(1006, 'network drop');
      });

      // Advance fake timers to trigger the first reconnect backoff (1000 ms)
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      const reconnectSocket = instances[instances.length - 1];

      act(() => {
        reconnectSocket.triggerOpen();
        reconnectSocket.triggerMessage({
          kind: 'AuthSuccess',
          payload: {
            player_id: 'player-south',
            display_name: 'SouthPlayer',
            session_token: 'session-token-refreshed',
            seat: 'South',
          },
        });
      });

      // State snapshot can remount CharlestonPhase while preserving staged incoming
      // in the UI store, so the player can continue forwarding tiles.
      act(() => {
        reconnectSocket.triggerMessage({
          kind: 'StateSnapshot',
          payload: {
            snapshot: {
              game_id: 'test-game-charleston-003',
              phase: { Charleston: 'FirstLeft' },
              current_turn: 'East',
              dealer: 'East',
              round_number: 1,
              turn_number: 0,
              remaining_tiles: 72,
              discard_pile: [],
              players: [
                {
                  seat: 'East',
                  player_id: 'player-east',
                  is_bot: false,
                  status: 'Active',
                  tile_count: 14,
                  exposed_melds: [],
                },
                {
                  seat: 'South',
                  player_id: 'player-south',
                  is_bot: false,
                  status: 'Active',
                  tile_count: 13,
                  exposed_melds: [],
                },
                {
                  seat: 'West',
                  player_id: 'player-west',
                  is_bot: true,
                  status: 'Active',
                  tile_count: 13,
                  exposed_melds: [],
                },
                {
                  seat: 'North',
                  player_id: 'player-north',
                  is_bot: true,
                  status: 'Active',
                  tile_count: 13,
                  exposed_melds: [],
                },
              ],
              house_rules: {
                ruleset: {
                  card_year: 2025,
                  timer_mode: 'Visible',
                  blank_exchange_enabled: false,
                  call_window_seconds: 10,
                  charleston_timer_seconds: 60,
                },
                analysis_enabled: true,
              },
              charleston_state: {
                stage: 'FirstLeft',
                selections: {},
                votes: {},
                courtesy_proposal: null,
              },
              your_seat: 'South',
              your_hand: [2, 5, 8, 10, 13, 17, 19, 22, 24, 27, 29, 32, 42],
              wall_seed: 1234567890,
              wall_draw_index: 52,
              wall_break_point: 18,
              wall_tiles_remaining: 72,
            },
          },
        });
      });

      // After snapshot, staged tiles are still represented exactly once
      expect(
        screen.getByTestId('staging-incoming-tile-incoming-FirstLeft-0-3')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('staging-incoming-tile-incoming-FirstLeft-1-14')
      ).toBeInTheDocument();

      // Server re-delivers pending staged tiles after reconnect
      act(() => {
        reconnectSocket.triggerMessage({
          kind: 'Event',
          payload: {
            event: {
              Private: {
                IncomingTilesStaged: {
                  player: 'South',
                  tiles: [3, 14],
                  from: null,
                  context: 'Charleston',
                },
              },
            },
          },
        });
      });

      // SET semantics: exactly 2 tiles restored, no duplication
      expect(
        screen.getByTestId('staging-incoming-tile-incoming-FirstLeft-0-3')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('staging-incoming-tile-incoming-FirstLeft-1-14')
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId('staging-incoming-tile-incoming-FirstLeft-2-3')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('staging-incoming-tile-incoming-FirstLeft-2-14')
      ).not.toBeInTheDocument();

      // Direction banner remains absent throughout
      expect(screen.queryByTestId('pass-animation-layer')).not.toBeInTheDocument();
    });

    test('snapshot remount preserves kept blind tiles without inflating the rack', async () => {
      renderWithProviders(<GameBoard initialState={gameStates.charlestonFirstLeft} ws={mockWs} />);

      await sendPrivate({
        IncomingTilesStaged: {
          player: 'South',
          tiles: [3, 14, 20],
          from: null,
          context: 'Charleston',
        },
      });

      const stagedRackTile = screen.getAllByTestId(/^tile-10-/)[0];
      await act(async () => {
        stagedRackTile.click();
      });

      const absorbedTile = screen.getByTestId('staging-incoming-tile-incoming-FirstLeft-0-3');
      await act(async () => {
        absorbedTile.click();
      });

      expect(
        screen.queryByTestId('staging-incoming-tile-incoming-FirstLeft-0-3')
      ).not.toBeInTheDocument();
      expect(screen.getByTestId('player-rack')).toHaveAttribute(
        'aria-label',
        'Your rack: 13 tiles'
      );

      await act(async () => {
        mockWs.triggerMessage({
          kind: 'StateSnapshot',
          payload: {
            snapshot: gameStates.charlestonFirstLeft,
          },
        });
      });

      expect(
        screen.queryByTestId('staging-incoming-tile-incoming-FirstLeft-0-3')
      ).not.toBeInTheDocument();
      expect(
        screen.getByTestId('staging-incoming-tile-incoming-FirstLeft-1-14')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('staging-incoming-tile-incoming-FirstLeft-2-20')
      ).toBeInTheDocument();
      expect(screen.getByTestId('player-rack')).toHaveAttribute(
        'aria-label',
        'Your rack: 13 tiles'
      );
    });
  });
});
