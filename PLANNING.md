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
