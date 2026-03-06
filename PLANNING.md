# American Mahjong Game - User Experience Planning

## 1. What Players Experience (The Game Flow)

### A. Getting Started

#### Login/Account

- Players open the app (desktop, mobile, or web)
- First-time users: Create account or play as guest
- Returning users: Log in to access stats, saved preferences

#### Main Menu/Lobby

- See lobby/main menu with options:
  - Start a new game
  - Join an existing game
  - Practice solo
  - View statistics/game history
  - Settings

#### Pre-Game Settings (Game Creation)

When creating or joining a game, players configure:

- **Opponent Selection**:
  - 3 other human players (online multiplayer)
  - AI opponents (practice mode)
  - Mix of humans and AI (fill empty seats)

- **AI Difficulty** (if playing with AI):
  - Beginner (random valid moves)
  - Intermediate (pattern-focused)
  - Advanced (strategic, tracks discards)

- **AI Assistance** (for human players):
  - None (purist mode)
  - Hints only (shows "1 tile away" messages)
  - Full assist (suggests moves, highlights patterns)

- **NMJL Card Year**:
  - Current year (default: 2025)
  - Previous years (2024, 2023, etc.) for practice
  - Custom/house rules card (if available)

- **House Rules**:
  - **Blank Tiles**: Enable/disable blank tiles (if set has them)
  - **Charleston Options**:
    - Mandatory first Charleston only
    - Optional second Charleston allowed
    - Blind pass (steal) allowed/disallowed
    - "Mush" last round
  - **Timer Settings**:
    - Turn timer (30/60/90 seconds, or unlimited)
    - Call window (5/10 seconds)
    - Charleston timer (60/90/120 seconds)

- **Audio/Visual**:
  - Sound effects on/off
  - Music on/off
  - Tile Discard Callout
  - Tile set style (traditional, modern, high-contrast)
  - Table color/theme

#### Game Setup (Once Players Ready)

- System assigns seats (East, South, West, North)
  - East is the dealer for the first round
  - Option: Let players choose seats vs. random assignment
- Each player receives access to "The Card" (in-app viewer)
- Wall is built: 152 tiles mixed face-down
- **Wall Building Animation** (optional, can skip):
  - Tiles shuffle visually
  - Each player's wall forms (19 tiles long, 2 tiles deep)
- East rolls dice to determine wall break point
- **Dealing Animation**:
  - East breaks wall at dice number
  - Tiles are dealt counterclockwise (to East's right)
  - Each player receives 12 tiles (dealt in groups of 4)
  - Final round: East takes 1st and 3rd tile, others take 1 each
  - Result: Each player has 13 tiles, East has 14
- Players organize tiles on their rack (concealed from others)

### B. The Charleston Phase (Tile Exchange)

#### Why This Exists

- In American Mahjong, players start with random tiles
- The Charleston lets you "clean house" by exchanging unwanted tiles with opponents
- This is mandatory (at least the first Charleston) and happens BEFORE the main game

#### The Flow (Per Official Rules)

#### FIRST CHARLESTON (Mandatory)

1. **First Right**: Each player selects 3 tiles to pass to the player on their RIGHT
2. **First Across**: Each player selects 3 tiles to pass to the player ACROSS from them
3. **First Left**: Each player selects 3 tiles to pass to the player on their LEFT
   - **Blind Pass/Steal Option**: Players may "steal" 1, 2, or 3 tiles on this pass
   - Example: If you only want to pass 1 tile, you can take 2 of the incoming tiles, add your 1, and pass all 3 to the left

#### STOP OR CONTINUE DECISION

1. **Stop/Continue Vote**: After first Charleston completes, ANY ONE PLAYER can stop the Charleston
   - If any player says "stop", proceed to Optional Courtesy Pass
   - If ALL players agree to continue, Second Charleston begins

#### SECOND CHARLESTON (Optional, requires unanimous agreement)

1. **Second Left**: Each player selects 3 tiles to pass to the player on their LEFT
2. **Second Across**: Each player selects 3 tiles to pass to the player ACROSS from them
3. **Second Right**: Each player selects 3 tiles to pass to the player on their RIGHT (reverse of first Charleston)
   - **Blind Pass/Steal Option**: Players may "steal" 1, 2, or 3 tiles on this last pass

#### COURTESY PASS (Optional)

1. **Courtesy Across**: Players ACROSS from each other negotiate passing 0, 1, 2, or 3 tiles
   - Each pair (North-South, East-West) decides independently
   - Lowest number wins: If North wants to pass 3 but South wants 1, only 1 tile is exchanged
   - This is NOT simultaneous—it's a negotiation between the two players

#### Critical Rules

- **Jokers can NEVER be passed** during Charleston
- Players must maintain exactly 13 tiles (14 for East) at all times
- Timer runs for each pass (typically 60-90 seconds to select)

#### What Players Need (UI/UX)

- Clear visual indication of which direction to pass (arrows, highlighting)
- Ability to select exactly 3 tiles (or fewer if doing a blind pass/steal)
- Tile selection interface:
  - Tap/click to select tiles
  - Selected tiles highlighted
  - "Confirm Pass" button (disabled until correct number selected)
- Real-time status updates:
  - "Waiting for Player 3 to pass tiles..."
  - "All players ready, passing now..."
- Incoming tiles animation (tiles slide in from the correct direction)
- Stop/Continue voting UI after first Charleston
- Courtesy Pass negotiation UI (for across partners to agree on 0-3 tiles)
- Timer countdown visible for each pass phase
- Option to enable/disable blind pass in house rules

### C. Main Game (The Drawing and Discarding Loop)

#### Turn Structure

1. **Draw**: Active player draws one tile from the wall
2. **Decision Time**: Player looks at their hand and decides:
   - Can I declare Mahjong (winning hand)?
   - If not, which tile should I discard?
3. **Discard**: Player discards one tile face-up to the center
4. **Call Window**: OTHER players have a brief moment to:
   - **Call** the discard (if it completes a Pung, Kong, or Quint in their hand)
   - **Declare Mahjong** (if the discard completes their winning hand)
   - **Pass** (let it go, turn moves to next player)

#### Special Rules

- **Jokers are Wild**: Can substitute for any tile in a Pung, Kong, or Quint (but not in a sequence, single or pair, except Joker pairs)
- **Dead Hand**: It's possible to call and expose tiles that make the hand unwinnable. A dead hand means it's impossible to win based on game circumstances.
- **No Claiming for Sequences**: Unlike other Mahjong variants, you can't call tiles for runs (1-2-3)—only for melds (3-3-3 or 4-4-4-4)

### D. Winning the Game

#### How You Win

- Your 14 tiles must match one of the patterns on "The Card"
- You can win by:
  - Drawing the winning tile yourself ("Self-Draw")
  - Calling someone else's discard ("Call Win")

#### What Happens

- Winner declares "Mahjong!"
- System freezes the game
- Winner's hand is revealed and validated against The Card
- Score is calculated based on:
  - Which pattern was used
  - Whether hand was concealed or exposed
  - Whether it was self-drawn or called
- Scores are updated
- Option to play another round (dealer rotates)

### E. End of Game

- Players can see final scores
- Statistics are saved (wins, favorite patterns, etc.)
- Option to rematch or return to lobby

---

## 2. Core Features Needed

### Game Mechanics

- **Tile Management**: Display, sort, organize 13-14 tiles per player
- **Wall/Deck System**: Shuffle, deal, draw from a 152-tile pool
- **Turn Management**: Enforce proper turn order, handle interruptions (calls)
- **Charleston Orchestration**: Manage simultaneous tile passing between all 4 players
- **Discard Pile**: Show all discarded tiles in order
- **Call System**: Detect valid calls, pause turn flow, resolve conflicts (multiple callers)
- **Win Validation**: Check if a hand matches ANY pattern on The Card

### User Interface

- **Hand Display**:
  - Tiles organized by suit/type
  - Ability to rearrange manually
  - Highlight tiles that are part of exposed melds
  - Visual distinction between concealed and exposed tiles
- **The Card Viewer**:
  - Show all valid winning patterns
  - Filter/search patterns
  - Highlight patterns that are "close" to your current hand
- **Game Table**:
  - Show all 4 player positions
  - Current turn indicator
  - Discard pile in center
  - Wall remaining count
- **Action Buttons**:
  - "Discard" (drag or tap)
  - "Call" / "Pass" (during call window)
  - "Mahjong" (declare win)
  - "Charleston: Select 3" (during Charleston)
- **Timer**:
  - Turn timer (30-60 seconds per turn)
  - Call window timer (5-10 seconds to decide)
  - Charleston timer (60 seconds to select 3 tiles)

### Multiplayer/Network

- **Real-Time Sync**: All players see state changes instantly
- **Reconnection Handling**: Players can rejoin if they disconnect
- **Spectator Mode**: Watch games in progress
- **Chat**: Optional text chat between players
- **Emoji/Reactions**: Quick expressions (Good job! Ouch! etc.)

### AI Opponents

- **Beginner AI**: Makes random valid moves
- **Intermediate AI**: Tries to build toward specific patterns
- **Advanced AI**: Tracks discards, defensive play, blocking

### Settings & Customization

- **Rule Variants**:
  - Enable/disable optional Charleston passes
  - Adjust timer lengths
  - House rules for joker usage
  - Blank tile secret swap with discard pile tile
- **Visual Themes**:
  - Tile designs (traditional, modern, high-contrast)
  - Table colors
  - Sound effects on/off
- **Accessibility**:
  - Text size adjustment
  - Colorblind modes
  - Screen reader support

---

## 3. Special Considerations

### A. The Annual Card Problem

- **Challenge**: The valid winning hands change every year
- **Solution**:
  - Store Card definitions as data (JSON or database)
  - Admin tool to upload new Card
  - Version the Card by year
  - Let players choose which year's Card to use (for practice/nostalgia)

### B. Joker Complexity

- **Challenge**: Jokers can represent ANY tile, creating thousands of permutations
- **User Perspective**:
  - When I have Jokers, show me what they COULD be
  - Auto-suggest where to use them
  - Validate wins even with ambiguous Joker placement
- **Technical Note**: Validation engine must try all possible Joker identities

### C. Charleston Synchronization

- **Challenge**: All 4 players are selecting and passing tiles simultaneously
- **User Perspective**:
  - Don't let the game hang if one player is slow
  - Show status: "Waiting for Player 3 to pass tiles..."
  - Auto-select random tiles if timer expires
- **Edge Cases**:
  - What if someone disconnects during Charleston?
  - What if two players disagree on whether to do optional pass?

### D. The Call Window (Race Conditions)

- **Challenge**: Multiple players might try to call the same discard
- **Rules**:
  - **Mahjong beats everything**: If someone can win, they get priority
  - **Closest player wins**: If two players both want to Pung, the one whose turn is next gets it
- **User Perspective**:
  - Make the "Call" button big and obvious
  - Audio cue when discard happens
  - Show "Player 2 called!" notification immediately
  - Handle gracefully: "Player 3 called first, sorry!"

### E. Hand Validation Feedback

- **Challenge**: Players need to know if they're CLOSE to winning
- **User Perspective**:
  - "You're 1 tile away from '2468 Consecutive Run'"
  - "Three patterns are possible with your current tiles"
  - Don't spoonfeed, but give hints
- **Progressive Disclosure**:
  - Beginner mode: Show exactly what you need
  - Expert mode: No hints, you figure it out

### F. Mobile vs Desktop Experience

- **Desktop**: More screen space, mouse precision, can show more info
- **Mobile**: Touch-friendly, bigger buttons, simplified "The Card" viewer
- **Shared Core**: Same game logic, different UI layouts

### G. Offline Play

- **Challenge**: What if internet drops mid-game?
- **Solutions**:
  - Solo practice mode works 100% offline (AI opponents)
  - Online games: Brief disconnects (30 sec) allow reconnection
  - Long disconnects: AI takes over, or game is forfeited

### H. Scoring Complexity

- **Current Scope**: Simple point system (each pattern worth X points)
- **Future**:
  - Official NMJL scoring (complex, hand-specific)
  - Leaderboards
  - Seasonal tournaments

---

## 4. MVP (Minimum Viable Product) vs. Future Features

### Phase 1: MVP (Core Game Loop)

- [ ] 4-player local game (hot-seat or AI)
- [ ] Full Charleston implementation
- [ ] Draw-Discard-Call loop
- [ ] Win validation against a single static Card (2024 or 2025)
- [ ] **Dead Hand Visualization**: Gray out patterns on "The Card" that are impossible based on exposed tiles.
- [ ] **Undo/Restore**: Allow players to step back or reset state during Practice/Solo matches.
- [ ] **Bot Voices**: Basic audio callouts for bot actions to increase immersion.
- [ ] Basic UI (functional, not pretty)
- [ ] Desktop only (web or Tauri)

### Phase 2: Multiplayer

- [ ] WebSocket server
- [ ] Online matchmaking
- [ ] Player accounts (username, stats)
- [ ] Reconnection logic

### Phase 3: Polish & Roadmap

- [ ] Animations (tiles sliding, discards flying)
- [ ] Sound effects & Music
- [ ] Mobile responsiveness
- [ ] Multiple Card years (data-driven)
- [ ] **Marvelous Mah Jongg Card**: Support for the Marvelous league cards.
- [ ] **Interactive Tutorial**: Guided "Learn to Play" bubbles and walkthroughs.

### Phase 4: Advanced

- [ ] Advanced AI (strategic play)
- [ ] Tournaments
- [ ] Replay system (watch past games)
- [ ] Custom Card editor (create house rules)

---

## 5. Non-Goals / Rejected Features

- **Multiple Mahjong Variants**: This application is strictly focused on American Mahjong (NMJL rules). Chinese, Hong Kong, and British variants are out of scope.

---

## 5. User Stories (To Guide Development)

**As a new player**, I want clear instructions during Charleston so I don't pass the wrong tiles.

**As an experienced player**, I want to quickly scan The Card and my hand to identify winning patterns.

**As a mobile user**, I want big, tappable buttons and auto-sorting so I don't fumble with tiny tiles.

**As a competitive player**, I want fast turn timers and low-latency multiplayer so the game feels snappy.

**As a casual player**, I want to pause and resume against AI without losing my game.

**As a tournament organizer**, I want to set up private rooms with custom rules (e.g., no optional Charleston).

**As a player with vision impairment**, I want high-contrast tile designs and text-to-speech for tile names.

---

## 5.x State/Event Boundary Baseline (Refactor Milestone 1)

### Server session/event dependency map

- `crates/mahjong_server/src/network/session.rs`
  - Public API:
    - `Session`, `StoredSession`, `SessionStore`
    - `Session::new_guest`, `Session::restore_from_token`, `Session::update_pong`, `Session::is_timed_out`, `Session::disconnect`, `Session::to_stored`
    - `StoredSession::is_expired`
    - `SessionStore::new`, `add_guest_session`, `restore_session`, `get_active`, `disconnect_session`, `cleanup_expired`, `take_stored_by_player_id`, `active_count`, `stored_count`
  - Behavior markers:
    - active sessions by `player_id`
    - stored sessions by `session_token` (5-minute grace window)
    - reconnection by token and by JWT/player_id path
    - heartbeat timeout and grace-period bot takeover

- `crates/mahjong_server/src/network/*` session call sites
  - `network/websocket/auth.rs`: creation/restoration and auth success emission
  - `network/websocket/router.rs`: uses active session for pong
  - `network/websocket/command.rs`: looks up active session for command auth + room/seat context
  - `network/websocket/room_actions.rs`: requires active session for create/join/leave/close operations
  - `network/websocket/mod.rs`: connect/authenticated loop + `disconnect_session` on socket close
  - `network/heartbeat.rs` + `network/websocket/heartbeat.rs`: heartbeat probes, timeout disconnect, bot takeover
  - `network/events.rs`: sends events via session transports

- Shared domain vs transport-only
  - Domain/state: player identity, room/seat, reconnection window, visibility/persistence policies
  - Transport-only: parse/serialize envelopes, socket lifecycle, reconnect/backoff, ping/pong scheduling

### Client boundary dependency map

- Protocol/transport layer
  - `apps/client/src/hooks/gameSocketTypes.ts`: envelope types, listener API, lifecycle state types
  - `apps/client/src/hooks/gameSocketDecoder.ts`: raw JSON decode + runtime guards
  - `apps/client/src/hooks/gameSocketProtocol.ts`: protocol state transitions + listener fanout
  - `apps/client/src/hooks/gameSocketTransport.ts`: socket open/close, reconnect logic, heartbeat queueing
  - `apps/client/src/hooks/useGameSocket.ts`: orchestrates transport + protocol + subscriptions
- Event handling layer
  - `apps/client/src/hooks/useGameEvents.ts`: event envelope orchestration + state snapshot derivation + effect dispatch
  - `apps/client/src/lib/game-events/*`: reducer handlers and side-effect models
    - `publicEventHandlers.ts` + `publicEventHandlers.*.ts`
    - `privateEventHandlers.ts`
    - `sideEffectManager.ts`
    - `types.ts`
  - Consumers:
    - `apps/client/src/components/game/*` + `components/game/phases/*`
    - `apps/client/src/hooks/useHistoryData.ts`, `useHistoryPlayback.ts`, `useHintSystem.ts`

- Shared contracts and duplication status
  - Server protocol boundary: `crates/mahjong_server/src/network/messages.rs` (`Envelope` and payloads)
  - Generated client contracts: `apps/client/src/types/bindings/generated/*` (from `ts_rs`)
  - Duplicate hand-maintained protocol contract currently in `apps/client/src/hooks/gameSocketTypes.ts`
  - `apps/client/src/features/lib/game-events/*` does not exist in this repository; handlers live in `apps/client/src/lib/game-events/*`

### Acceptance baseline target for split

- Preserve behavior for: auth/guest/token/jwt creation, disconnect grace, heartbeat timeout, reconnect and snapshot flow, public/private event routing, and side effect semantics during first pass.
- Convert incrementally to explicit protocol/state/event boundaries before removing current monoliths.

### 5.x.1 Milestone 2 + 3 Progress (Current)

- **Milestone 2 (session split)** is in-progress and compatibility-first:
  - `crates/mahjong_server/src/network/session.rs` is now a facade/module shimming into `crates/mahjong_server/src/network/session/{state,auth,reconnect,heartbeat,events}.rs`.
  - `Session`/`StoredSession` and `SessionStore` behavior is preserved with active map by `player_id`, stored map by `session_token`, 5-minute stored expiry, and reconnection helpers.
  - `SessionStore::disconnect_session` and `SessionStore::cleanup_expired` are migrated behind dedicated module methods.
- **Milestone 3 (boundary split)** is partially complete:
  - Server: protocol parsing (`websocket/protocol.rs`), routing/effects split (`websocket/handlers.rs` + `websocket/router.rs`), and event dispatch module (`network/events/dispatcher.rs`).
  - Client: notifications and side-effect execution live in `apps/client/src/lib/game-events/eventNotifications.ts` and `apps/client/src/lib/game-events/eventSideEffects.ts`; reducer application path is now in `apps/client/src/lib/game-events/eventResult.ts`.
  - `apps/client/src/hooks/useGameEvents.ts` now consumes these boundary modules instead of duplicating notification/side-effect/reducer logic.

### 5.x.2 Milestone 3 Boundary Hardening Chunk (2026-03-05)

- Added `apps/client/src/lib/game-events/eventDispatchers.ts` as a dedicated event orchestration boundary that owns:
  - Event envelope dispatch (`Event` / `StateSnapshot` / `Error`) and delegation to public/private reducer handlers.
  - Error handling policy (idempotent Charleston `ALREADY_SUBMITTED`, invalid-tile/state-resync behavior).
  - History + hint notification emission.
- Updated `apps/client/src/hooks/useGameEvents.ts` to inject orchestration dependencies into `createEventDispatchers(...)` and consume only boundary entry points (`handleEventEnvelope`, `handleStateSnapshotEnvelope`, `handleErrorEnvelope`), preserving existing transport/auth/session boundaries.

### 5.x.3 Milestone 3 Boundary Consolidation Chunk (2026-03-05)

- Added a small compatibility safety cleanup:
  - Removed non-null assertion from Charleston-phase error handling path in `apps/client/src/lib/game-events/eventDispatchers.ts` (`inCharleston` now handles null/undefined snapshot phases safely).
- Added the chunk-level migration note in this section to keep refactor decisions discoverable before proceeding to any further boundary split work.
- No behavioral changes were intended; this remains a compatibility-first continuation with existing server/client contracts unchanged.

### 5.x.4 Milestone 2/3 Boundary Finalization Checkpoint (2026-03-05)

- Session boundary status:
  - Server `session` module is split into `state`, `auth`, `reconnect`, `heartbeat`, and `events` submodules with behavior still exposed through `Session`/`SessionStore`/`StoredSession` compatibility APIs.
  - Active sessions remain keyed by `player_id`; stored sessions by `session_token`; reconnection grace remains `StoredSession::is_expired`-driven (5 minutes).
  - Heartbeat remains 60-second timeout (`Session::is_timed_out` / heartbeat loop timing behavior unchanged).
- WebSocket/server boundary status:
  - Parsing (`websocket/protocol.rs`) and envelope dispatch (`websocket/router.rs` + `websocket/handlers.rs`) are separated from state/effects handlers (`command`, `room_actions`).
  - Dispatch flow remains: auth -> session store bootstrap in `websocket/auth.rs` -> heartbeat task wrapper -> text handler parses envelope via protocol -> router dispatches to handlers.
- Client boundary status:
  - `gameSocketDecoder.ts` handles JSON runtime validation.
  - `gameSocketTransport.ts` handles lifecycle/reconnect/heartbeat/queue only.
  - `gameSocketProtocol.ts` maps inbound envelopes to protocol/state transitions and listener fanout.
  - `useGameEvents.ts` and `game-events/*` enforce pure reducer + explicit side-effect execution boundary (`eventResult` + `eventSideEffects`).
- No additional compatibility shim removals were performed in this pass; this checkpoint is a verified, behavior-first inventory.

### 5.x.5 Milestone 2/3 Boundary Hardening Completion (2026-03-05)

- Session-layer hardening status is confirmed against behavior invariants:
  - Active sessions remain keyed by `player_id`.
  - Stored sessions remain keyed by `session_token`.
  - Reconnect grace remains 5-minute `StoredSession::is_expired` behavior.
  - `Session::is_timed_out` and heartbeat enforcement remain at the 60-second timeout threshold.
- WebSocket protocol hardening status is confirmed:
  - Client envelope parsing is isolated in `websocket/protocol.rs`.
  - Envelope routing remains in `websocket/router.rs` and action handling in `websocket/handlers.rs`.
  - `websocket/mod.rs` still performs authenticated dispatch and delegates to existing session/room call sites.
- Client boundary hardening status is confirmed:
  - Decoder/protocol/transport separation remains (`gameSocketDecoder.ts`, `gameSocketProtocol.ts`, `gameSocketTransport.ts`).
  - Event orchestration remains in `eventDispatchers.ts`.
  - Reducer and effect execution remain split in `eventResult.ts` and `eventSideEffects.ts`.
- Risk: No behavior tests were executed in this pass; this is a static hardening verification checkpoint.

### 5.x.6 Milestone 2/3 Boundary Hardening Consolidation (2026-03-05)

- Session boundary hardening confirmed as behavior-first:
  - Session map partitioning is preserved: active by `player_id`, stored by `session_token`.
  - Reconnect grace remains `StoredSession::is_expired` (5 minutes).
  - Heartbeat timeout remains 60 seconds through `Session::is_timed_out`.
- Server websocket boundary hardening confirmed:
  - Parser remains in `websocket/protocol.rs` (pure envelope decode).
  - Router remains message-type dispatch only (`websocket/router.rs` + `websocket/handlers.rs`).
  - Lifecycle handlers (auth, heartbeat scheduling, cleanup) remain in `websocket/mod.rs` and `websocket/auth.rs`.
- Client boundary hardening confirmed:
  - Storage helpers moved out of protocol state-handling into `gameSocketStorage.ts`.
  - Protocol remains decode/fsm/notification-fanout (`gameSocketProtocol.ts`).
  - Transport remains connect/reconnect/queue/heartbeat scheduling (`gameSocketTransport.ts`).
  - Event orchestration/pure reducer/effects boundaries remain: `useGameEvents.ts`, `eventDispatchers.ts`, `eventResult.ts`, `eventSideEffects.ts`.
- Milestone status for this pass: **complete** (no behavior test execution performed).
- Next action in this checkpoint is only cleanup/signoff: verify the same invariants on reconnect/bot takeover from live behavior once you run integration flows.

### 5.x.7 Milestone 2/3 Runtime Verification Checkpoint (2026-03-05)

- Runtime verification executed for reconnect + heartbeat timeout invariants:
  - `cargo test -p mahjong_server --test networking_integration reconnect_restores_room_and_seat -- --nocapture` passed.
  - `cargo test -p mahjong_server --test networking_integration ping_pong_timeout_disconnects -- --nocapture` passed.
  - `cargo test -p mahjong_server --lib -- --nocapture` passed (includes websocket router/handlers/session-state coverage).
- Client boundary verification executed:
  - `npx tsc --noEmit` passed.
  - `npx vitest run apps/client/src/hooks/useGameSocket.test.ts apps/client/src/hooks/useGameEvents.test.ts apps/client/src/hooks/gameSocketDecoder.test.ts` passed (55 tests).
- Verified outcomes:
  - Reconnect restores room + seat through token flow.
  - Heartbeat timeout path disconnects as expected and remains compatible with bot takeover scheduling.
  - Websocket protocol/router/handler boundary split compiles and passes unit/integration coverage.
- Milestone status after execution: **Milestone 2/3 checkpoint verified** for reconnect + timeout behavior.

### 5.x.8 Refactor Epic Closure (2026-03-06)

- Server event boundary adoption completed for external emit paths:
  - Admin endpoints and websocket response broadcasting now call `network/events/dispatch_room_event(...)` instead of invoking `room.broadcast_event(...)` directly.
- Client/server contract duplication reduced:
  - Added TS export coverage for websocket payload contracts in `network/messages.rs` (auth/join/error/command/pong payloads + enums).
  - `gameSocketTypes.ts` now consumes generated payload types for these contracts instead of inline duplicated payload shapes.
- Full validation pipeline completed successfully (`cargo fmt/check/test/clippy`, `npx prettier`, `npx tsc`, `npm run check:all`).
- Epic status: **complete** for module decomposition + boundary decoupling objectives; remaining ts-rs serde-attribute parse warnings are non-blocking and do not affect runtime behavior.

## 6. Open Questions to Resolve Before Coding

1. **Scoring System**: Are we using official NMJL points, or a simplified system?
2. **Card Source**: Do we manually input the 2025 Card, or scrape it from somewhere?
3. **Matchmaking**: Random opponents, or invite-only private games?
4. **Platform Priority**: Should we build web-first, or desktop-first?
5. **AI Difficulty**: How smart should the "Advanced" AI be? (This could take months to perfect.)
6. **Monetization**: Free? Ads? Premium features? (Affects server costs.)

---

## 7. Success Metrics (How We Know It's Working)

- **Functional**: A 4-player game can complete from Charleston to Mahjong without crashes.
- **Accurate**: Win validation is 100% correct (no false positives/negatives).
- **Fast**: Turn actions feel instant (<100ms server response).
- **Fun**: Playtesters prefer this to physical tiles (subjective, but measurable via surveys).

---

**Next Steps**: Once this plan is approved, we'll translate it into technical architecture (which modules handle what) and start coding the `mahjong_core` crate.
