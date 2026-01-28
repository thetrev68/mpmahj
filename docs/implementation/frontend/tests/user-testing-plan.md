# Manual User Testing Plan for American Mahjong Frontend

Comprehensive checklist for human testers to verify UX correctness and game flow integrity after automated test suite passes. Focus: does the game *feel* right and respond correctly to player actions?

---

## Test Execution Rules

- **Test Environment**: Real Rust backend (`cargo run` in `crates/mahjong_server/`), real frontend (Vite dev server)
- **Participants**: Tester + 3 bots (or 4 human testers if available)
- **Repetitions**: Minimum 2 full game flows per scenario. More if edge case detected.
- **Issue Tracking**: Log any deviations from expected behavior with screenshots/video

---

## Part 1: Lobby & Room Setup

### Scenario 1.1: Create Room, Join as Guest

- [ ] Launch app in fresh browser
- [ ] Click "Create Room"
- [ ] Select card year (2025)
- [ ] Select bot difficulty (Easy)
- [ ] Toggle "Fill with bots" ON
- [ ] Confirm: Room created, seat assigned (1-4), bots auto-join within 2 seconds
- [ ] Confirm: "Ready" button appears when all 4 seats filled

### Scenario 1.2: Join Existing Room

- [ ] Create room (Player 1)
- [ ] Copy room ID
- [ ] Launch second browser/window (Player 2)
- [ ] Click "Join Room"
- [ ] Enter room ID
- [ ] Confirm: Player 2 joins, assigned different seat, game shows 2/4 players

### Scenario 1.3: Room Close & Cleanup

- [ ] In room with multiple players, have host click "Close Room"
- [ ] Confirm: All players kicked out, returned to lobby
- [ ] Confirm: Room ID becomes invalid for new joins

---

## Part 2: Setup Phase (Dice Roll)

### Scenario 2.1: Dice Roll Sequence

- [ ] Game starts, East seat selected
- [ ] Confirm: "Roll Dice" button visible to East player only
- [ ] East clicks "Roll Dice"
- [ ] Confirm: Two dice appear on screen with random values
- [ ] Confirm: Wall breaking happens (tiles drawn from wall)
- [ ] Confirm: All 4 players receive hand tiles (~13 each)
- [ ] Confirm: All 4 players can see their own hand (others show tile count only)

---

## Part 3: Charleston Phase (Most Critical)

### Scenario 3.1: First Pass (FirstRight - Standard)

- [ ] Game shows "FirstRight - Select 3 tiles to pass right"
- [ ] Tester clicks 3 tiles in hand
- [ ] Confirm: Tiles highlight as selected
- [ ] Tester clicks "Pass Tiles"
- [ ] Confirm: Button disables, waiting message appears
- [ ] Wait for other 3 players to pass (bots are fast, ~1 second each)
- [ ] Confirm: All 4 players show "Ready for pass" message
- [ ] Confirm: Tiles pass to right player
- [ ] Confirm: Tester receives 3 new tiles from left player
- [ ] Confirm: Hand reorganizes (alphabetical/suit order)

### Scenario 3.2: FirstLeft with Standard Pass

- [ ] Game shows "FirstLeft - Select 3 tiles to pass left"
- [ ] Tester selects 3 tiles from hand
- [ ] Tester clicks "Pass Tiles" (standard pass)
- [ ] Confirm: Tiles pass left to next player
- [ ] Confirm: Received tiles are visible

### Scenario 3.3: FirstLeft with Blind Pass (Tester selects 1-2 tiles)

- [ ] Game shows "FirstLeft - Select 1-3 tiles to pass left"
- [ ] Tester selects ONLY 1 tile (not 3)
- [ ] Confirm: "Blind Pass: 2 tiles" selector appears below hand
- [ ] Tester confirms blind pass count (e.g., "Blind Pass: 2")
- [ ] Tester clicks "Pass Tiles"
- [ ] Confirm: 1 visible tile + 2 blind tiles pass left
- [ ] Tester receives 3 tiles back
- [ ] Confirm: 2 tiles are marked as [HIDDEN] or grayed out (blind tiles from other player)
- [ ] Confirm: Tester's blind pass tiles are hidden from ALL players

### Scenario 3.4: FirstLeft IOU Detection (All 4 players blind pass all 3)

- [ ] Manually force: All 4 players select "Blind Pass: 3" on FirstLeft
- [ ] Confirm: "IOU Detected - Skip to Courtesy Pass" message appears
- [ ] Confirm: Phase transitions directly to CourtesyAcross
- [ ] Note: FirstRight and FirstAcross tiles remain in hand

### Scenario 3.5: Vote Phase (VotingToContinue)

- [ ] After FirstLeft passes, vote phase shows "Continue or Stop?"
- [ ] Tester clicks "Continue"
- [ ] Confirm: Button disables, vote recorded
- [ ] If all players vote "Continue": Phase advances to SecondLeft
- [ ] If any player votes "Stop": Phase skips to CourtesyAcross

### Scenario 3.6: SecondLeft & SecondAcross (Reversed Direction)

- [ ] Confirm: Game shows "SecondLeft - Select 3 tiles"
- [ ] Tester passes tiles left (reversed from FirstRight)
- [ ] Confirm: Tiles flow correctly
- [ ] Confirm: SecondAcross follows (passing across to partner)

### Scenario 3.7: SecondRight with Blind Pass

- [ ] Game shows "SecondRight - Select 1-3 tiles"
- [ ] Tester selects 2 tiles, sets blind pass to 1
- [ ] Confirm: 2 visible + 1 blind pass to right
- [ ] Confirm: Received tiles include blind tiles

### Scenario 3.8: Courtesy Pass Negotiation (CourtesyAcross)

- [ ] Game shows "Courtesy Pass - Propose tiles to partner"
- [ ] Tester (partner pair) proposes 0 tiles (click "0" button or equivalent)
- [ ] Confirm: Private message to partner: "Partner proposed 0 tiles"
- [ ] Partner responds with proposal (e.g., 1 tile)
- [ ] Confirm: Tester sees "Partner proposed 1 tile"
- [ ] Confirm: Minimum of two proposals is used (0 vs 1 = 0 tiles)
- [ ] Tester clicks "Agree"
- [ ] Confirm: If proposal was > 0, tester selects those tiles
- [ ] Confirm: "Courtesy pass complete" message
- [ ] Confirm: Partner's hand updated with courtesy tiles

### Scenario 3.9: Courtesy Pass Mismatch

- [ ] Tester proposes 3 tiles, partner proposes 0 tiles
- [ ] Confirm: Private message: "Mismatch - Using 0 tiles"
- [ ] Confirm: No tiles exchanged
- [ ] Confirm: Charleston complete

### Scenario 3.10: Full Charleston Edge Case - Short Circuit by Stop Vote

- [ ] FirstRight passes complete
- [ ] FirstAcross passes complete
- [ ] FirstLeft passes complete, blind pass used
- [ ] Vote phase: Tester votes "Stop"
- [ ] Confirm: Game skips SecondLeft, SecondAcross, SecondRight
- [ ] Confirm: Jumps directly to CourtesyAcross
- [ ] Confirm: First Charleston tiles remain (not re-exchanged)

---

## Part 4: Playing Phase - Turn Progression

### Scenario 4.1: Draw & Discard Sequence

- [ ] Game shows "Your Turn - Draw Tile"
- [ ] Tester clicks "Draw Tile"
- [ ] Confirm: One tile appears in hand (from wall or dead wall)
- [ ] Confirm: Tile count shown (14 tiles in hand)
- [ ] Confirm: "Discard Tile" button becomes active
- [ ] Tester clicks a tile in hand
- [ ] Confirm: Tile highlights as selected for discard
- [ ] Tester clicks "Discard Tile" button
- [ ] Confirm: Tile moves to discard pile
- [ ] Confirm: Turn passes to next player
- [ ] Confirm: Turn indicator shows "East Player's Turn" (or similar)

### Scenario 4.2: Call Window - Intent Buffering

- [ ] Player 1 (East) discards a 5 Crak
- [ ] Confirm: Call window opens for Players 2, 3, 4 (not East)
- [ ] Confirm: 10-second timer displayed
- [ ] Confirm: "Pass", "Pung", "Kong", "Mahjong" buttons visible (if applicable)
- [ ] Player 2 clicks "Pung" (intends to claim for pair)
- [ ] Confirm: "Pass" button should now be only option (or button disables)
- [ ] Player 3 clicks "Pass"
- [ ] Confirm: Player 4 still can act (not all passed yet)
- [ ] Player 4 clicks "Mahjong"
- [ ] Confirm: Priority resolved: Mahjong > Pung (Player 4 wins the call)
- [ ] Confirm: Tile goes to Player 4, not Player 2

### Scenario 4.3: Call Window - Timer Expiration

- [ ] Discard happens, call window opens
- [ ] Tester does NOT click any button
- [ ] Confirm: Timer counts down to 0
- [ ] Confirm: All players auto-pass at timer expiration
- [ ] Confirm: Turn advances to next player (normal draw/discard)

### Scenario 4.4: Call Priority Resolution (Mahjong > Meld > Turn Order)

- [ ] Set up scenario: Player 2 can call Pung, Player 3 can call Kong, Player 4 can call Mahjong
- [ ] All declare at roughly same time (in buffering window)
- [ ] Confirm: Mahjong call wins (Mahjong > Kong > Pung)
- [ ] Confirm: Player 4 receives tile, declares win

### Scenario 4.5: Multiple Melds

- [ ] Mid-game, Tester has 2-3 exposed melds
- [ ] Confirm: Each meld displays correctly with tile layout
- [ ] Confirm: Meld source tracked (tiles called vs drawn)
- [ ] Confirm: Can upgrade melds (Pung → Kong) if eligible

---

## Part 5: Special Actions During Play

### Scenario 5.1: Joker Exchange

- [ ] Tester's hand contains 1+ Joker
- [ ] Tester's exposed melds contain 1+ Joker (as placeholder)
- [ ] Tester draws a real tile that matches the placeholder
- [ ] Confirm: "Exchange Joker?" dialog appears
- [ ] Tester clicks "Accept"
- [ ] Confirm: Joker moves to hand, real tile replaces Joker in meld
- [ ] Confirm: Meld updates visually

### Scenario 5.2: Meld Upgrade (Pung → Kong → Quint/Sextet)

- [ ] Tester exposed pung (3 of a kind)
- [ ] Tester draws the 4th tile matching that pung
- [ ] Confirm: "Upgrade to Kong?" dialog appears
- [ ] Tester clicks "Upgrade"
- [ ] Confirm: Pung becomes Kong (4-wide in UI)
- [ ] Confirm: Tester draws replacement tile from dead wall
- [ ] Confirm: Replacement tile visible and added to hand

### Scenario 5.3: Blank Exchange (House Rule - Secret)

- [ ] If blank exchange rule enabled, tester can click blank exchange button
- [ ] Confirm: Dialog allows exchange of real tile for blank in own melds
- [ ] Confirm: Action is secret (not broadcast to other players)
- [ ] Confirm: Event log shows "You exchanged a tile" (vague message)

---

## Part 5.5: Analysis & Hints Panel

### Scenario 5.5.1: Hint Panel Visibility

- [ ] During Playing phase, tester clicks "Hints" or "Analysis" button
- [ ] Confirm: Hints panel appears (side panel, overlay, or modal)
- [ ] Confirm: Panel shows current hand analysis
- [ ] Confirm: "Close" or "Hide" button to dismiss panel
- [ ] Confirm: Panel can be reopened without game interruption

### Scenario 5.5.2: Verbosity Level Selection

- [ ] Hints panel open
- [ ] Confirm: Three verbosity options visible: "Beginner", "Intermediate", "Expert"
- [ ] Confirm: Current level highlighted/selected
- [ ] Tester clicks "Expert"
- [ ] Confirm: Panel updates with more detailed hint information
- [ ] Confirm: Suggested patterns show more advanced combinations
- [ ] Tester clicks "Beginner"
- [ ] Confirm: Panel simplifies to high-level guidance only

### Scenario 5.5.3: Suggested Patterns Display

- [ ] Hand contains: 1B 1B 1B 2B 2B 3B 3B 4B 5B 6B 7B 8B 9B Dragon
- [ ] Open Hints panel
- [ ] Confirm: Panel shows list of possible winning patterns (e.g., "Consecutive Run: 1B-9B + Pair", "Like Numbers: Bams Pung + Other melds")
- [ ] Confirm: Each pattern shows required tiles and current hand completeness
- [ ] Confirm: Patterns are accurate against NMJL rules (~60 valid patterns)
- [ ] Confirm: Patterns sorted by viability (most likely to achieve first)

### Scenario 5.5.4: Recommended Discards

- [ ] Same hand state as 5.5.3
- [ ] Open Hints panel
- [ ] Confirm: "Recommended Discards" section shows tiles to discard
- [ ] Confirm: Discards are ranked by priority (top tile = safest discard)
- [ ] Confirm: Discard tiles do NOT contribute to any suggested pattern
- [ ] Confirm: Discards marked with reason (e.g., "Not in any pattern", "Duplicate for pair")
- [ ] Tester selects a recommended discard tile
- [ ] Confirm: Discard made successfully
- [ ] Next turn, hand updated, hints refresh

### Scenario 5.5.5: Hint Accuracy - Completion Distance

- [ ] Hand: 1B 1B 1B 2C 2C 2C 3D 3D 3D 5W 5W 6W 7W 8W
- [ ] Open Hints panel
- [ ] Confirm: Pattern "Consecutive Run: 5W-9W + Eyes" shows "Distance: 1 tile (need 9W)"
- [ ] Confirm: Pattern "All Honors" shows "Distance: 6+ tiles"
- [ ] Confirm: Closer patterns ranked higher
- [ ] Tester draws 9W
- [ ] Confirm: Hints panel updates immediately
- [ ] Confirm: "Consecutive Run" now shows "Distance: 0 tiles - WIN!" or "Ready"

### Scenario 5.5.6: Hint Accuracy - Pair Detection

- [ ] Hand missing pair but other melds complete
- [ ] Open Hints panel
- [ ] Confirm: Hints show all patterns and their pair requirements
- [ ] Confirm: If hand has 2 dragons and pattern requires pair, pattern distance shows "1 pair + N tiles"
- [ ] Tester draws matching pair tile
- [ ] Confirm: Hints update, pattern distance decreases

### Scenario 5.5.7: Joker Handling in Hints

- [ ] Hand contains: Joker 1B 1B 2C 2C 2C (etc., with 1 Joker)
- [ ] Open Hints panel
- [ ] Confirm: Patterns account for Joker as wildcard
- [ ] Confirm: Pattern "Mixed Pung: 1B-1B-Joker" shown as viable
- [ ] Confirm: Recommended discards do NOT suggest discarding the Joker (unless necessary)
- [ ] Note: Some patterns cannot use Jokers (e.g., Honors/Terminals only) - confirm these patterns are NOT suggested when Joker is only option

### Scenario 5.5.8: Hidden Tiles in Charleston

- [ ] Mid-Charleston after FirstLeft blind pass
- [ ] Tester has 1+ hidden tiles from opponent's blind pass
- [ ] Open Hints panel
- [ ] Confirm: Hints ONLY consider tiles tester knows about (hand + visible melds)
- [ ] Confirm: Hidden tiles are NOT factored into pattern analysis
- [ ] Confirm: Hints still show reasonable paths forward

### Scenario 5.5.9: Hint Refresh on External State Change

- [ ] Tester has hints panel open
- [ ] Another player calls a meld (tile removed from discard pile)
- [ ] Confirm: Hints panel is NOT affected (hints are for own hand only)
- [ ] Another player claims a tile (turn changes away from tester)
- [ ] Confirm: Hints remain visible and accurate for tester's hand
- [ ] Tester's turn comes back
- [ ] Confirm: Hints remain fresh and accurate

### Scenario 5.5.10: Hint Accuracy - Variable Suit Patterns

- [ ] Hand contains: 1B 2B 3B 4C 5C 6C 7D 8D 9D 1W 1W 2W 3W Dragon
- [ ] Open Hints panel, set to "Expert"
- [ ] Confirm: Pattern "Like Numbers: Bams + Cracks + Dots" shown
- [ ] Confirm: Pattern requires all suit combinations (not just one suit repeated 3x)
- [ ] Confirm: Distance calculated correctly for this variable-suit constraint

### Scenario 5.5.11: Beginner vs Advanced Hints Difference

- [ ] Hand: 1B 1B 1B 2B 2B 3B 3B 4B 5B 6B 7B 8B 9B Dragon
- [ ] Open Hints, select "Beginner"
- [ ] Confirm: Shows only the most obvious patterns (e.g., "Consecutive Run: 1B-9B")
- [ ] Confirm: Shows 1-2 recommended discards (the safest ones)
- [ ] Switch to "Expert"
- [ ] Confirm: Shows 10+ possible patterns including obscure combinations
- [ ] Confirm: Shows 5+ recommended discards with detailed analysis
- [ ] Confirm: All patterns from Beginner mode are also in Expert (Expert is superset)

### Scenario 5.5.12: Hint Performance (No Lag)

- [ ] Open Hints panel
- [ ] Confirm: Panel appears within 500ms (no noticeable delay)
- [ ] Switch verbosity level
- [ ] Confirm: Content updates within 300ms
- [ ] Tester draws tile while hints panel open
- [ ] Confirm: Hints refresh within 200ms of hand update
- [ ] Play 5 turns with hints panel constantly open
- [ ] Confirm: No UI stuttering or freezes

### Scenario 5.5.13: Hint Panel Persistence Across Phases

- [ ] Hints panel open during Playing phase
- [ ] Tester declares Mahjong
- [ ] Confirm: Hints panel closes (game over, hand locked)
- [ ] OR Confirm: Hints panel shows "Hand complete - Mahjong ready"
- [ ] Game over screen shows
- [ ] Confirm: Hints panel not visible on game over screen
- [ ] New game starts (Charleston phase)
- [ ] Confirm: Hints not available during Charleston (no analyzing yet)

### Scenario 5.5.14: Accuracy Cross-Check Against Backend

- [ ] Hand: 2C 2C 2C 5D 5D 5D 9W 9W 1B 1B 1B 4B 4B Dragon
- [ ] Open Hints, request analysis
- [ ] Frontend shows patterns + distances
- [ ] Manual verification: Does "Consecutive Run 5W-9W + Eyes" require Dragon + 1 more tile? (Should be YES - need 7W 8W 9W or already have them)
- [ ] Confirm: Frontend analysis matches manual calculation
- [ ] Repeat with 2-3 more hands to verify backend validation is consistent

---

## Part 6: Mahjong Declaration & Validation

### Scenario 6.1: Winning Hand - Self Draw

- [ ] Tester completes a winning pattern with self-drawn tile
- [ ] Confirm: "Declare Mahjong?" button active
- [ ] Tester clicks "Declare Mahjong"
- [ ] Confirm: Hand validation happens server-side
- [ ] Confirm: If valid: "Heavenly Hand" or normal win announced
- [ ] Confirm: Scores calculated and displayed
- [ ] Confirm: Game over screen shows hand breakdown

### Scenario 6.2: Winning Hand - Called Tile

- [ ] Tester calls discard, completing winning hand
- [ ] Confirm: "Declare Mahjong?" button active immediately
- [ ] Tester clicks "Declare Mahjong"
- [ ] Confirm: Hand validation, win announced

### Scenario 6.3: Invalid Hand Declaration

- [ ] Tester hand incomplete (missing 1 tile or invalid pattern)
- [ ] Tester clicks "Declare Mahjong"
- [ ] Confirm: Server rejects, error message shown
- [ ] Confirm: Game continues (hand not declared dead)

### Scenario 6.4: Hand Declared Dead (Wall Exhausted)

- [ ] Game continues draw → discard cycles until wall exhausted
- [ ] Confirm: Final dead wall tiles drawn
- [ ] Confirm: No player declares Mahjong before dead wall exhausted
- [ ] Confirm: "Game Over - Wall Exhausted" message
- [ ] Confirm: No winner, scores reset for next round

---

## Part 7: Smart Undo

### Scenario 7.1: Undo Solo (Immediate)

- [ ] Tester makes a discard or call decision
- [ ] Tester immediately clicks "Undo"
- [ ] Confirm: Action reverses instantly (no voting)
- [ ] Confirm: Tile goes back to hand or meld restored
- [ ] Confirm: Turn reverts (back to draw phase or tester's draw)

### Scenario 7.2: Undo Multiplayer (Voting)

- [ ] Tester makes discard, other players have already acted
- [ ] Tester clicks "Undo"
- [ ] Confirm: "Undo requested - waiting for votes" message
- [ ] Confirm: Other 3 players see "Player X requests undo - Yes/No" dialog
- [ ] If all vote Yes: Undo applies
- [ ] If any vote No: Undo rejected, game continues from current state

### Scenario 7.3: Undo Rejection

- [ ] Undo request in multiplayer scenario
- [ ] Players 2 & 3 vote Yes, Player 4 votes No
- [ ] Confirm: "Undo rejected" message
- [ ] Confirm: Game state unchanged

---

## Part 8: History Mode

### Scenario 8.1: View Move History

- [ ] Mid-game or after game, tester clicks "View History"
- [ ] Confirm: Move list appears (Draw Tile 1, Discard 2 Crak, Call Pung, etc.)
- [ ] Confirm: Current move highlighted
- [ ] Confirm: Can scroll through all moves

### Scenario 8.2: Jump to Move

- [ ] History open, tester clicks on move #15 in list
- [ ] Confirm: Game state rewinds to after move #15
- [ ] Confirm: All UI updates (hand, discard pile, melds, turn indicator)
- [ ] Confirm: "Viewing History" banner appears
- [ ] Confirm: Normal action buttons disabled (can't take actions in history mode)

### Scenario 8.3: Resume from History

- [ ] In history mode at move #20, tester clicks "Resume from Here"
- [ ] Confirm: Moves 21+ are deleted
- [ ] Confirm: Game resumes from move #20's end state
- [ ] Confirm: "Viewing History" banner disappears
- [ ] Confirm: Normal buttons re-enabled

### Scenario 8.4: Return to Present

- [ ] In history mode, tester clicks "Return to Present"
- [ ] Confirm: Game state jumps to current game state (all moves replayed)
- [ ] Confirm: UI updates to actual game state

---

## Part 9: Connection & Recovery

### Scenario 9.1: Disconnect & Reconnect During Charleston

- [ ] Mid-Charleston (e.g., FirstAcross pass in progress)
- [ ] Tester closes browser tab or kills network
- [ ] Wait 3-5 seconds
- [ ] Tester opens browser, re-launches app
- [ ] Confirm: Auto-reconnect triggers (or manual reconnect button visible)
- [ ] Confirm: "Authenticating..." message appears
- [ ] Confirm: Game state fully restored to correct Charleston stage
- [ ] Confirm: Tester's hand matches what was expected
- [ ] Confirm: Can continue playing normally

### Scenario 9.2: Disconnect During Call Window

- [ ] Call window open, tester hasn't voted
- [ ] Tester disconnects
- [ ] Reconnect after 2 seconds
- [ ] Confirm: Call window timer sync'd with server time
- [ ] Confirm: Can still see discard and vote options
- [ ] If timer still has time: Confirm can vote
- [ ] If timer expired: Confirm vote already submitted as pass

### Scenario 9.3: Session Token Refresh

- [ ] Play for extended period (>30 minutes)
- [ ] Confirm: Game continues without re-authentication
- [ ] Confirm: No unexpected disconnects or dropouts

### Scenario 9.4: Rejoin After Room Close

- [ ] Disconnect during game
- [ ] Wait > 10 seconds
- [ ] Host closes room
- [ ] Tester attempts reconnect
- [ ] Confirm: Auth succeeds, but room is gone
- [ ] Confirm: Error message: "Room no longer exists"
- [ ] Confirm: Returned to lobby

---

## Part 10: Bot Behavior & Multi-Player Scenarios

### Scenario 10.1: Easy Bot Behavior

- [ ] 3 easy bots + 1 tester player
- [ ] Play 1 full game
- [ ] Confirm: Bots make reasonable Charleston passes (3 tiles, no jokers)
- [ ] Confirm: Bots discard tiles consistently
- [ ] Confirm: Bots sometimes call/pass on melds (not 100% predictable)
- [ ] Confirm: Game completes without crashes

### Scenario 10.2: Hard Bot Behavior

- [ ] 3 hard bots + 1 tester player
- [ ] Play 1 full game
- [ ] Confirm: Bots make strategic plays (different from easy)
- [ ] Confirm: Bots call more intelligently
- [ ] Confirm: Game completes without crashes

### Scenario 10.3: 4 Human Players

- [ ] 4 human testers in same room
- [ ] Play 1 full Charleston
- [ ] Confirm: All passes work correctly (no desync)
- [ ] Confirm: Turn order respected
- [ ] Confirm: Each player sees correct private info

---

## Part 11: UI Polish & Responsiveness

### Scenario 11.1: Button Responsiveness

- [ ] During tester's turn, click "Draw Tile"
- [ ] Confirm: Button disables immediately (prevents double-click)
- [ ] Confirm: Tile appears within 1 second
- [ ] Confirm: "Discard" button enables smoothly

### Scenario 11.2: Hand Display & Tile Selection

- [ ] Hand has 14 mixed tiles
- [ ] Confirm: Hand displays alphabetically (1B, 1C, 1D, 1W, 2B, etc.)
- [ ] Confirm: Tile selection highlights clearly (color change or outline)
- [ ] Confirm: Deselection works (click selected tile again)
- [ ] Confirm: Multi-select for passes (select 3 tiles total)

### Scenario 11.3: Event Log Clarity

- [ ] Play several turns
- [ ] Confirm: Event log shows human-readable messages ("East discarded 5 Crak", "You passed 3 tiles", etc.)
- [ ] Confirm: Events categorized correctly (turn, charleston, call, mahjong, etc.)
- [ ] Confirm: Can scroll through old events

### Scenario 11.4: Error Messages

- [ ] Try invalid actions (discard before draw, select 2 tiles for 3-tile pass)
- [ ] Confirm: Error message appears immediately
- [ ] Confirm: Error is specific ("Please select exactly 3 tiles")
- [ ] Confirm: Error auto-dismisses after 5 seconds

---

## Part 12: Game Over & Scoring

### Scenario 12.1: Mahjong Win - Display Hand

- [ ] Player declares mahjong
- [ ] Confirm: Winning hand displayed clearly
- [ ] Confirm: Patterns highlighted (Pung, Kong, Quint, eyes, etc.)
- [ ] Confirm: Score calculation shown

### Scenario 12.2: Game Over Screen

- [ ] After winner declared
- [ ] Confirm: "Game Over" screen with final scores
- [ ] Confirm: Winner highlighted
- [ ] Confirm: "Play Again" and "Return to Lobby" buttons

### Scenario 12.3: Multi-Round Session

- [ ] Complete game, click "Play Again"
- [ ] Confirm: New game starts immediately
- [ ] Confirm: East seat rotates to next player
- [ ] Confirm: Charleston restarts
- [ ] Play 2-3 more games without returning to lobby

---

## Part 13: Regression Check - Known Problem Areas

### Scenario 13.1: Blind Pass Tile Visibility

- [ ] Player A blind passes tiles to Player B
- [ ] Player B blind passes tiles back to Player A
- [ ] Confirm: Player A's blind tiles remain hidden to all players
- [ ] Confirm: Player B's blind tiles remain hidden to all players
- [ ] Confirm: No tile is revealed prematurely

### Scenario 13.2: IOU Edge Case

- [ ] Manually engineer: All 4 players blind pass all 3 on FirstLeft
- [ ] Confirm: IOU detection triggers
- [ ] Confirm: Phase transitions correctly to CourtesyAcross
- [ ] Confirm: No crash or desync

### Scenario 13.3: Call Priority with Tied Intentions

- [ ] Set up: Player A and Player B both can call Pung on same tile
- [ ] Both declare roughly simultaneously
- [ ] Confirm: Turn order breaks tie (first in turn order wins)
- [ ] Confirm: Correct player receives tile

### Scenario 13.4: Meld Upgrade with Joker

- [ ] Pung contains joker (3B, 3B, Joker)
- [ ] Player draws 4th real tile (3B)
- [ ] Confirm: "Upgrade to Kong?" appears
- [ ] Confirm: After upgrade, Kong shows (3B, 3B, 3B, Joker)
- [ ] Confirm: Replacement tile drawn from dead wall correctly

### Scenario 13.5: Undo During Active Call Window

- [ ] Tester makes discard
- [ ] Call window opens
- [ ] Player 2 clicks "Mahjong" (buffered intent)
- [ ] Before call resolves, tester clicks "Undo"
- [ ] Confirm: Undo is blocked or rejected (can't undo when call active)
- [ ] OR Confirm: Undo correctly reverts discard and call window closes

---

## Completion Checklist

- [ ] All 13 parts tested with zero critical failures
- [ ] No crashes observed
- [ ] All state transitions happen at expected times
- [ ] WebSocket reconnection tested and working
- [ ] Multi-player synchronization verified
- [ ] Charleston (all 10+ sub-phases) flows smoothly
- [ ] Call window priority logic working correctly
- [ ] Undo (solo and voting) functions as designed
- [ ] History mode (jump, resume, truncate) working
- [ ] UI responsive and error messages clear
- [ ] Game completion and scoring correct
- [ ] All major bot difficulty levels tested
- [ ] 2+ full game loops per scenario completed

---

## Known Limitations & Future Testing

- **Performance under lag**: Should test with network throttling (2G, 3G)
- **Mobile responsiveness**: Playwright E2E should include mobile viewport
- **Accessibility**: Screen reader testing not covered (future enhancement)
- **Stress testing**: 100+ games on same backend (volume testing)
- **Byzantine player behavior**: What if player sends malformed commands? (server validation tested, not UI)
