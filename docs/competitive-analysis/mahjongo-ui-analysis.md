# Mahjongo UI Analysis

**Date**: 2026-01-18
**Source**: <https://mahjongo.com/american>
**Context**: Charleston phase - First Charleston, passing right

## Game Board Layout

### Table View (3D Perspective)

- Green felt table surface with angled walls
- Four player positions (North, South, East, West)
- Each player has a rack area for their tiles
- Clear spatial separation between player areas

### Current Player Indicators

- Player avatars positioned at each seat
- Score/coins display next to each avatar (showing "8900" for visible players)
- Top player (opponent) has avatar with coins displayed

### Game State Display

- Large central modal/dialog box with dark background
- Clear phase announcement: "First Charleston"
- Instructional text: "Pass 3 tiles to the player on your right"
- "Pass" button (currently green/enabled, likely because 3 tiles are selected)

### Tile Selection Area

- Selected tiles appear in a highlighted staging area above the player's rack
- Currently shows 3 tiles selected (2 White Dragons, 1 Flower tile)
- Visual feedback for selected tiles (they appear raised/highlighted)

### Player's Hand Rack

- Bottom of screen shows player's tiles in a horizontal row
- Tiles include: 3 Jokers, various numbered Craks (3C, 6C, 9C), multiple 3D and 8D tiles, and a Flower
- Tiles are clearly rendered with suit symbols and numbers
- Red numbering on some tiles for emphasis

### Left Sidebar Controls

- "Sort By Suit" button
- "Sort By Rank" button
- "No Call" toggle option
- "Auto Discard" toggle option
- Game name: "American Mahjong"

### Top Right UI

- Settings gear icon
- Signal/connection indicator (showing bars)
- Weekly Leaderboard panel showing top 5 players with scores

### Visual Design Notes

- Clean, modern 3D rendering
- Good contrast between tiles and table surface
- Clear visual hierarchy (game state > tiles > controls)
- Green color scheme throughout (consistent branding)
- Tile graphics are large and readable

## Key UX Elements to Consider

1. **Clear Phase Communication**: The modal makes it impossible to miss what action is required
2. **Visual Tile Selection**: Staging area shows exactly what you're about to pass
3. **Action Confirmation**: "Pass" button only enables when requirements are met (3 tiles)
4. **Spatial Player Representation**: 3D table helps players understand directional passing
5. **Utility Controls**: Sort functions easily accessible
6. **Auto-play Options**: "No Call" and "Auto Discard" for faster play
7. **Social Elements**: Leaderboard integration
8. **Score Tracking**: Coins/points visible at all times

## Strengths

- **Excellent visual clarity**: Easy to understand game state at a glance
- **Good feedback**: Clear indication when action requirements are met
- **Spatial awareness**: 3D perspective helps with directional game mechanics
- **Accessibility features**: Auto-play options for casual players
- **Social integration**: Leaderboard encourages engagement

## Potential Improvements for Our Implementation

- Consider if 3D rendering adds value vs complexity for our initial MVP
- Tile staging area is a great pattern for Charleston phase
- Modal approach for phase transitions is very clear
- Sort controls should be prominent and easily accessible
- Consider balance between visual polish and development time
