# Mahjong 4 Friends UI Analysis

**Date**: 2026-01-18
**Source**: Mahjong 4 Friends app
**Context**: Charleston phase - First Charleston, passing right (3/4 tiles selected)

## Game Board Layout

### Table View (2D Top-Down)

- Flat 2D perspective with light green/mint felt background
- Four player positions clearly marked with compass rose (N, S, E, W)
- Player names displayed at each position (Bot 2, Bot 3, Trev, Bot 1)
- Simple, minimalist design approach

### Player Racks

- Top: Single row of orange/tan colored tile backs (opponent's concealed tiles)
- Left/Right sides: Vertical stacks of orange tile backs (opponent racks)
- Bottom: Player's visible hand showing tile faces
- Number indicator "99" on left side (wall tiles remaining)

### Game State Display

- Light yellow instruction box (top right quadrant)
- Clear text: "Welcome to the Charleston. Select 3 tiles you would like to pass right, then hit Proceed."
- Non-modal approach - doesn't block view of the entire board

### Tile Selection Area

- Center of board shows staging area for selected tiles
- Currently displays 3 Chinese character tiles (5 South Wind, 5 Red Dragon, 9 Red Dragon)
- Three dotted outline boxes indicating where tiles can be placed
- Visual feedback: Selected tiles appear in staging area

### Player's Hand Rack

- Bottom of screen shows player's tiles in horizontal row
- Tiles include: 1 Flower, 1 Flower, multiple Dots (5D, 7D, 8D, 8D), 2 Green Dragon, multiple Bams (5B, 5B, 6B)
- Traditional tile artwork with Chinese characters
- Orange/yellow numbering on tiles

### Control Panel (Center-Left)

- Large pill-shaped buttons with rounded corners
- "Proceed (3/4)" - shows progress indicator
- "New Game"
- "End Game"

### Control Panel (Center-Right)

- "Suggested Hands" button
- "Swap Joker" button
- "Mahjong" button
- "History" button

### Top Right Corner

- Settings gear icon
- Fullscreen toggle icon

### Visual Design Notes

- Warm color palette (orange, tan, brown, mint green)
- Traditional Chinese tile artwork (more authentic looking)
- Clean, flat design (no 3D effects)
- Minimalist UI with good contrast
- Larger tile representations

## Key UX Elements to Consider

1. **2D Top-Down View**: Simpler rendering, focuses on tiles not perspective
2. **Non-Modal Instructions**: Instruction box doesn't block the game board
3. **Progress Indicator**: "Proceed (3/4)" shows exactly how many tiles selected
4. **Compass Rose**: Clear directional indicator for understanding passing direction
5. **Dotted Placeholders**: Visual guide for where to place selected tiles
6. **Suggested Hands**: AI assistance feature for less experienced players
7. **Traditional Tile Art**: More authentic Chinese Mahjong aesthetic
8. **Centered Controls**: All action buttons in middle of screen for easy access

## Strengths

- **Simplicity**: Very clean, uncluttered interface
- **Progress feedback**: "(3/4)" counter is excellent UX
- **Traditional aesthetics**: Appeals to players familiar with physical Mahjong
- **Non-blocking instructions**: Can see full game state while reading instructions
- **Compass navigation**: Clear visual reference for directional passing
- **Helper features**: "Suggested Hands" helps new players learn

## Weaknesses/Observations

- **Less immersive**: 2D view less engaging than 3D perspective
- **Smaller visible area**: Orange tile backs take up significant screen space
- **Limited visual feedback**: Selected tiles staging area is simple but functional
- **Button placement**: Center buttons might obstruct view of tiles during selection
- **No score display**: Can't see player scores at a glance (unlike Mahjongo's coin display)

## Comparison to Mahjongo

| Feature                | Mahjongo               | Mahjong 4 Friends                 |
| ---------------------- | ---------------------- | --------------------------------- |
| **Perspective**        | 3D angled view         | 2D top-down                       |
| **Visual Style**       | Modern, polished       | Traditional, minimalist           |
| **Instructions**       | Modal dialog           | Non-modal text box                |
| **Progress Indicator** | Button enable/disable  | "(3/4)" counter                   |
| **Tile Staging**       | Raised area above rack | Center board with dotted outlines |
| **Controls**           | Left sidebar           | Center panel                      |
| **Social Features**    | Leaderboard visible    | Not visible in this screen        |
| **Player Info**        | Avatar + coins         | Names + compass                   |
| **Tile Art**           | Modern, simplified     | Traditional Chinese               |

## Recommendations for Our Implementation

1. **Progress indicators**: The "(3/4)" pattern is clearer than just enable/disable
2. **Non-modal instructions**: Consider whether blocking modals or text boxes work better
3. **Compass rose**: Simple, effective way to show directional relationships
4. **Dotted placeholders**: Good visual affordance for tile selection
5. **Balance complexity**: 2D might be easier to implement for MVP, 3D more engaging
6. **Traditional vs Modern**: Consider target audience preference for tile aesthetics
7. **Helper features**: "Suggested Hands" could be valuable for onboarding
8. **Control positioning**: Ensure buttons don't obstruct gameplay
