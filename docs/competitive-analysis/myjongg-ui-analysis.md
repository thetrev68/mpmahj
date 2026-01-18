# MyJongg UI Analysis

**Date**: 2026-01-18
**Source**: <https://www.myjongg.net/>
**Context**: Charleston phase - First Right pass (no tiles selected yet)

## Game Board Layout

### Table View (Hybrid 2D/3D)

- Green felt table surface (flat)
- Four rectangular player areas divided by dark borders
- Player positions clearly labeled at each quadrant
- Decorative background image (sunset/candle scene) behind the play area
- Semi-transparent player areas overlay the background

### Player Information

- Top: "Erica Nurney (bot)" with star rating (5 stars shown)
- Left: "Evan Sabove (bot)" with star rating
- Right: "Jim Pansey (bot)" with star rating
- Bottom: "thetrev68 (You) - East" with player indicator and controls
- Avatar icons shown for each player
- Green "present" indicator (dot) next to player names

### Game State Display

- Large yellow/gold text instruction in center: "First Right" -- select three tiles to pass, then click the 'Pass Tiles' button to pass them to the player on your right. You may not pass jokers."
- "Pass Tiles" button centered below instructions (white/gray, appears disabled until tiles selected)
- Top left corner: "Wall Tiles Remaining: 99" in white text on green bar

### Player's Hand Rack

- Bottom section shows player's tiles in horizontal row
- Green background with darker green bar above for controls
- Control buttons on green bar:
  - Player icon with "thetrev68 (You) - East"
  - Settings
  - Sort by Rank
  - Sound: On
  - Results
  - Help
  - Restart (red button)
  - Leave (red button)
- Tiles shown: Multiple Craks (2C, 2C, 2C, 2C, 9C), multiple Bams (7B, 8B), 1 Flower, 2 East Winds, 2 White/Soap Dragons
- Traditional tile artwork with both modern symbols and Chinese characters
- Italic instruction text below tiles: "Left-click tiles to select, left-click and drag tiles to rearrange them, right-click tiles to turn them."

### Right Sidebar (Dark Panel)

- Three tabs: "Messages", "Discards", "Card"
- Game log showing:
  - "thetrev68 joined the game."
  - "thetrev68 started the game."
- Chat input at bottom: "Type chat here..." with "Send" button

### Visual Design Notes

- Dark borders creating strong visual separation between player areas
- Green and black color scheme with gold/yellow accents
- Traditional tile artwork (more realistic than Mahjongo, less traditional than M4F)
- Decorative atmospheric background (unique among the three)
- Clean typography with good contrast
- Larger tiles than Mahjongo, similar size to M4F

## Key UX Elements to Consider

1. **Hybrid Layout**: Rectangular player zones (like board game) rather than circular table
2. **Detailed Instructions**: Very explicit, includes rule reminder ("You may not pass jokers")
3. **Wall Count Prominent**: Tile count displayed at top of screen
4. **Multi-Function Sidebar**: Chat, discards, and card view in one panel
5. **Tile Manipulation**: Right-click to rotate tiles (unique feature)
6. **Player Status**: Green dot indicators for online presence
7. **Star Ratings**: Player skill/experience shown via stars
8. **Position Indicator**: Clear "East" dealer marker
9. **Atmospheric Design**: Background image adds personality
10. **Inline Help Text**: Instructions directly below tiles

## Strengths

- **Clear communication**: Very detailed instructions prevent confusion
- **Rule reminders**: "You may not pass jokers" helps new players
- **Tile rotation**: Right-click feature allows players to organize their view
- **Social features**: Chat integration, player presence indicators
- **Skill visibility**: Star ratings help players understand opponents' experience
- **Multi-purpose sidebar**: Efficient use of screen space
- **Wall count**: Important game state information always visible
- **Atmospheric**: Background image creates mood/personality

## Weaknesses/Observations

- **No progress indicator**: Can't see how many tiles selected (unlike M4F's "3/4")
- **No tile staging area**: Selected tiles don't move to separate area
- **Button disable state**: "Pass Tiles" appears grayed but no visual feedback on selection
- **Busy background**: Decorative image might distract from gameplay
- **Rectangular layout**: Less intuitive than circular table for directional passing
- **Control density**: Many buttons in bottom bar might be overwhelming

## Comparison Table

| Feature                | Mahjongo           | Mahjong 4 Friends           | MyJongg                    |
| ---------------------- | ------------------ | --------------------------- | -------------------------- |
| **Perspective**        | 3D angled          | 2D top-down circular        | 2D rectangular zones       |
| **Background**         | Solid green table  | Solid mint green            | Decorative image           |
| **Instructions**       | Modal dialog       | Non-modal text box          | Centered bold text         |
| **Progress Indicator** | Button state only  | "(3/4)" counter             | None visible               |
| **Tile Staging**       | Raised area        | Center with dotted outlines | None (in-hand selection)   |
| **Player Info**        | Avatar + coins     | Name + compass              | Name + rating + status dot |
| **Controls Location**  | Left sidebar       | Center panels               | Bottom green bar           |
| **Social Features**    | Leaderboard        | Not visible                 | Chat + presence            |
| **Help Text**          | In modals          | Separate screens            | Inline under tiles         |
| **Tile Art Style**     | Modern simplified  | Traditional Chinese         | Hybrid modern/traditional  |
| **Wall Count**         | Not visible        | "99" small indicator        | Prominent top bar          |
| **Sound Toggle**       | Likely in settings | Not visible                 | Quick-access button        |
| **Tile Manipulation**  | Click only         | Click only                  | Click + right-click rotate |
| **Rule Reminders**     | Separate help      | Separate help               | Inline with instructions   |

## Design Philosophy Analysis

**Mahjongo**: Premium gaming experience

- Polished 3D graphics
- Modern social features (leaderboard)
- Streamlined, focused interface
- Target: Casual gamers wanting engaging visuals

**Mahjong 4 Friends**: Traditional simplicity

- Authentic tile artwork
- Minimalist clean design
- Helper features (suggested hands)
- Target: Traditional Mahjong players, learning-friendly

**MyJongg**: Community-focused platform

- Chat and social features prominent
- Detailed instructions and rule reminders
- Atmospheric personality (background)
- Player presence and skill ratings
- Target: Social players, online community building

## Unique Features Worth Considering

**From MyJongg:**

1. **Right-click tile rotation**: Allows personal organization preference
2. **Inline rule reminders**: "You may not pass jokers" in main instruction
3. **Player presence indicators**: Green dots show who's online/active
4. **Skill ratings**: Stars give context about opponents
5. **Wall tiles prominent**: Critical game state always visible
6. **Chat integration**: Social interaction during play
7. **Discard tracking**: Separate tab for viewing discarded tiles
8. **Card access**: Quick reference to NMJL card patterns
9. **Atmospheric backgrounds**: Adds personality beyond pure functionality

## Recommendations for Our Implementation

1. **Progress feedback**: Definitely implement counter like M4F's "(3/4)"
2. **Tile staging**: Visual separation of selected tiles is valuable (M4F/Mahjongo approach)
3. **Rule reminders**: Consider inline hints like MyJongg for Charleston rules
4. **Wall count**: Should be visible (MyJongg approach)
5. **Social features**: Chat/presence if multiplayer focused, leaderboard if competitive
6. **Instruction style**: Test modal vs non-modal with users
7. **Tile manipulation**: Consider drag-to-reorder at minimum, maybe rotation feature
8. **Help accessibility**: Balance between inline (MyJongg) and modal (Mahjongo)
9. **Visual style decision**: Choose between:
   - Modern/polished (Mahjongo)
   - Traditional/authentic (M4F)
   - Atmospheric/personality (MyJongg)
10. **Layout choice**: 2D simpler to implement, 3D more immersive - consider MVP vs future

## Technical Observations

**Performance Considerations:**

- MyJongg's rectangular layout easier to implement than circular
- 2D rendering simpler than Mahjongo's 3D
- Background image: ensure doesn't impact load time/performance
- Real-time chat requires WebSocket infrastructure (we have this!)

**Accessibility:**

- MyJongg's high contrast text is good
- Inline instructions more accessible than modal dialogs
- Tile size important for mobile - MyJongg's are quite large
- Right-click functionality may not translate to mobile (need alternative)

**Responsive Design:**

- Rectangular layout (MyJongg) easier to adapt to different screen sizes
- Circular layout (M4F) maintains proportions better
- Side panels (MyJongg/Mahjongo) require different mobile treatment
- Bottom controls (all three) work well for mobile
