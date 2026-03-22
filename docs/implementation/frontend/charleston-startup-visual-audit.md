# Charleston Startup Visual Audit

Purpose: capture what stands out visually in the Charleston startup screenshot before any tiles are clicked, using the naming established in `charleston-startup-ui-map.md`.

Scope:

- Visual hierarchy
- Spacing and composition
- Relative prominence of major UI regions
- First-pass observations, not final design decisions

## Overall Read

The screen is functional and legible, but the composition feels split between several competing regions:

- `CharlestonTracker`
- `WallCounter`
- opponent racks
- `PlayerZone`
- `RightRailHintSection`

The result is a board that reads more like multiple independent widgets than one intentionally composed Charleston screen.

## What Stands Out First

### 1. The Main Task Is Not Dominant Enough

The most important action in this state should be:

1. select 3 tiles
1. stage them
1. press `Proceed`

But the visual emphasis is spread across the top strip, the right rail, and the board perimeter. `StagingStrip` and `ActionBar` do not feel clearly established as the primary interaction focal point.

Why this stands out:

- `StagingStrip` is visually lighter than the rack and action panel
- `ActionBar` feels like a floating utility box rather than the center of the current task
- `HintPanel` attracts too much attention for a secondary support tool

## Specific Observations

### `CharlestonTracker`

What I notice:

- It is information-dense for its height.
- It reads more like a status/debug strip than polished board chrome.
- The pass label, progress pill, ready row, and timer all compete equally.

Potential direction:

- Give the pass direction and progress stronger hierarchy.
- Reduce the visual weight of readiness details.
- Make the timer feel more integrated instead of like another pill dropped into the row.

### `WallCounter`

What I notice:

- It looks visually detached from `CharlestonTracker`.
- It reads like a separate floating widget rather than part of the same chrome system.
- It is clear, but not integrated.

Potential direction:

- Unify it more strongly with the top chrome.
- Either dock it into the top system or make its floating treatment feel intentional and related.

### `OpponentRack`

What I notice:

- The racks themselves are readable and the table geometry is understandable.
- The seat labels feel slightly too small and low-contrast relative to the size of the rack bodies.
- The right-side rack feels crowded by the right rail.

Potential direction:

- Improve seat-label presence.
- Rebalance spacing between `OpponentRack (South)` and the right rail.
- Consider whether opponent staging tiles should feel more attached to their rack bodies.

### `PlayerZone`

What I notice:

- This is the area that most wants refinement.
- `StagingStrip`, `ActionBar`, and `PlayerRack` do not feel like one unified local-player control surface.
- The `ActionBar` sits in open felt and feels detached from the staging strip.
- The whole zone feels slightly too low and too spread apart.

Potential direction:

- Tighten the spacing between `StagingStrip` and `ActionBar`.
- Make the action area feel structurally attached to the player interaction zone.
- Reconsider whether the player zone should read as one grouped module instead of three adjacent pieces.

### `StagingStrip`

What I notice:

- The six empty slots are understandable.
- The strip looks a little too understated for the current primary action.
- It does not visually “claim” enough importance relative to the local rack and right rail.

Potential direction:

- Strengthen the presence of the strip during Charleston.
- Make it feel more like the live destination for selection, not just a placeholder tray.

### `ActionBar`

What I notice:

- The black translucent box feels harsher than nearby elements.
- It looks overlaid rather than designed into the board.
- The instruction text is useful, but the panel styling makes it feel secondary and slightly temporary.
- The `Proceed` button does not project enough confidence as the primary action.

Potential direction:

- Integrate the panel more naturally with `PlayerZone`.
- Give the primary action more visual authority.
- Soften or re-theme the black panel treatment to better match the rest of the board.

### `PlayerRack`

What I notice:

- The rack is readable and visually anchors the player’s hand.
- The wood shell is heavier than the `StagingStrip`, which makes the rack feel more important than the active Charleston task.
- The selection counter is clear but slightly detached from the rest of the interaction flow.

Potential direction:

- Keep the rack strong, but let the staging/action layer take more emphasis during Charleston.
- Make the relationship between rack selection and staging destination more obvious.

### `RightRailHintSection` and `HintPanel`

What I notice:

- The rail is polished enough to feel like a real product surface.
- It is also too dominant for this particular moment.
- The white `HintPanel` is dense and bright, so it pulls attention away from the Charleston interaction.
- It feels more visually finished than the center action area, which is backwards for this state.

Potential direction:

- Reduce its dominance during Charleston.
- Let it remain available without feeling like the primary content column.
- Keep support information secondary to action-taking.

## Highest-Priority Visual Issues

If I had to rank what feels most worth changing first:

1. The relationship between `StagingStrip`, `ActionBar`, and `PlayerRack`
1. The visual dominance of `RightRailHintSection` during Charleston
1. The hierarchy and density of `CharlestonTracker`
1. The lack of shared visual language between `CharlestonTracker`, `WallCounter`, and `ActionBar`
1. The crowding on the right side between `OpponentRack (South)` and the right rail

## Summary in One Sentence

The board works, but the screen currently emphasizes status and support surfaces almost as much as the actual Charleston interaction, so the main task does not yet feel like the clear visual center.

## How To Use This Note

When comparing your own reactions to mine, the useful question is not “is Codex right?” but:

- which of these observations match what you already feel
- which ones are irrelevant to your goals
- which important issues you notice that are missing here

That comparison should make your future change requests much easier to phrase.

---

## Gemini's comments

Looking at the UI for your American Mahjong app, there are several opportunities to improve the visual hierarchy, clarity, and overall "game-feel." Here is a breakdown of identified improvements:

### 1. Visual Hierarchy & Emphasis

- **The "Mahjong" Button:** In the center modal, the "Mahjong" button has a gold/brown color that blends into the wooden tile racks. Since this is the "win" action, it should be the most distinct and high-contrast button on the screen (perhaps a vibrant red or gold with a glow effect).
- **Active Player Indicator:** The current "West (Bot)," "North (Bot)," etc., labels are quite small. It isn't immediately obvious whose turn it is or which direction the pass is going without reading the small text in the top-left corner.
- **AI Hint Pane:** The hint panel is very text-heavy and uses a small, uniform font size. The "Recommended Pass" should be significantly larger and bolder than the technical "Utility Scores" or "Tile Scores."

### 2. Layout & Alignment

- **Modal Placement:** The "Proceed / Mahjong" modal is overlapping the bottom-right of the center play area. Centering this more intentionally or moving it away from active gameplay elements would feel less cluttered.
- **Rack Scaling:** The side racks (North/West/East) look a bit "flat" and stretched compared to the player's bottom rack. Maintaining a consistent perspective or 3D depth for all four racks would improve immersion.
- **Empty Spaces:** There is a large amount of unused green space on the right side behind the AI Hint panel. You might consider expanding the game board to fill more of the screen or integrating the Hint panel more seamlessly into the sidebar.

### 3. Gameplay Clarity (UX)

- **Pass Direction Visuals:** The top bar says "Pass Right." Instead of just text, a large, animated arrow in the center of the table during the Charleston would make the action intuitive.
- **Tile Readability:** On the bottom rack, the "S" and "N" on the Winds and the numbers on the Cracks/Bams are a bit thin. Increasing the weight of these characters on the tile faces will help accessibility.
- **Selection Feedback:** The "0/3 selected" text is small and easy to miss. When a tile is selected for the Charleston, it should probably pop up slightly higher in the rack or have a bright border to confirm it's "in the tray" to be passed.

### 4. Technical UI Polish

- **Timer Visibility:** The timer (45s / 60s) is tucked away in the header. If the game is meant to be fast-paced, a visual progress bar that shrinks or changes color (green to red) would be more effective than static text.
- **Header Links:** The "Imported From Fir...", "Personal", "Syteline" etc., are browser bookmarks. In a production build, you'll want to ensure the app uses the full viewport (`100vh`) to hide the browser chrome and keep the focus on the game.
- **AI Hint "Get New Hint" Button:** This button is at the very bottom of a long scrolling list. If the list of patterns is long, the user might not even know that button exists. It should likely be pinned to the top or bottom of that sidebar.

### 5. Aesthetic Consistency

- **Color Palette:** The dark green felt and wood grain are classic, but the "AI Hint" panel's translucent white background feels a bit "modern web" compared to the "traditional game" look of the rest of the UI. Applying a slight wood-frame border or a darker "parchment" texture to the sidebar might unify the design.

---

## Claude's Comments

A few things jump out at me:

1. **"Mahjong" button during Charleston** — This is the most jarring one. You can't declare Mahjong during the Charleston pass phase, so that gold button shouldn't be there (or should be hidden/disabled). It's visually prominent and could confuse a new player into thinking it's a valid action.

2. **AI Hint panel — "10000.0" scores** — The Tile Scores section shows 10000.0 for South Wind, North Wind, and Red Dragon. Even if those are intentional sentinel/infinity values meaning "never pass these," showing raw 10000.0 to a user looks like a debug artifact rather than meaningful guidance. Something like "∞" or "Keep" would communicate the intent better.

3. **Staging area has 6 slots but selection limit is 3** — The counter says "0/3 selected" but there are clearly 6 dashed slots. Even if the extra slots serve a purpose in blind-pass phases, right now it looks like you could stage 6 tiles when the rule says 3.

4. **Header redundancy** — "3/4 ready" is shown as a count, and then immediately next to it you see East• South✓ West✓ North✓ per-seat. That's two ways of communicating the same readiness state in very tight space. One or the other would be cleaner.

5. **Instruction tooltip feels disconnected** — The "Charleston. Select 3 tiles to pass right..." text is floating in a rounded dark box mid-screen. It's not anchored to anything obvious (not the staging area, not the action buttons), so it reads more like a system notification than contextual UI guidance.
