# Ideal Game Board Elements - American Mahjong

This document lists all screen elements one would expect during gameplay for American Mahjong, from first principles. This is independent of current implementation, styles, colors, or themes - just a comprehensive inventory of what an ideal game board would contain.

## Core Game Board Elements

### Player's Area

- **Player hand** (14 tiles, organized/sortable)
- **Exposed melds** (your Pungs/Kongs/Quints on the table)
- **Seat indicator** (East/South/West/North)
- **Dealer indicator** (button/marker showing dealer)
- **Score/points** (current game score)
- **Ready status** (indicator if player has declared ready)

### Table Center/Common Area

- **Discard pool** (all discarded tiles, visible to everyone)
  - **Most recent discard** (highlighted/emphasized)
  - **Discard ownership** (who discarded what)
- **Wall tile count** (remaining tiles in wall)
- **Dead wall indicator** (last 14 tiles that can't be drawn)
- **Current wind** (round wind - East/South/West/North)
- **Game number/round** (which round/hand you're on)

### Opponents' Areas (×3)

- **Opponent name/identifier**
- **Tile count** (how many tiles in hand - concealed)
- **Exposed melds** (their visible Pungs/Kongs/Quints)
- **Seat position** (East/South/West/North)
- **Dealer marker** (if applicable)
- **Connection status** (online/offline/thinking)
- **Score** (current points)

### Turn/Action Indicators

- **Active player indicator** (whose turn it is)
- **Turn timer** (countdown for current player's action)
- **Phase indicator** (Charleston/Main Game/Scoring/etc.)
- **Available actions** (what you can do right now)
  - Discard
  - Call (Pung/Kong/Quint)
  - Mahjong
  - Pass
  - Charleston pass
  - Vote

### Charleston-Specific Elements

- **Charleston stage** (Right/Across/Left, First/Second)
- **Tiles to pass** (selection area for 3 tiles)
- **Tiles received** (incoming tiles from others)
- **Blind pass indicator** (optional 1-2 tile exchange)
- **Vote status** (Continue/Stop - your vote + others)
- **Courtesy pass negotiation** (0-3 tile exchange UI)

### Game State Information

- **Game phase** (Waiting/Charleston/Playing/Game Over)
- **Current pattern card year** (2017/2018/2019/2020/2025)
- **Joker count** (how many jokers remain in play)
- **Flower count** (flowers collected/exposed)

### Pattern/Strategy Reference

- **The Card viewer** (NMJL pattern card for the year)
  - Pattern categories (2468, Consecutive Run, etc.)
  - Individual patterns with scores
  - Hand value (current pattern being played)
- **Hand analysis** (which patterns are possible with current hand)
- **Distance to Mahjong** (how many tiles needed)
- **Suggested discards** (AI hints - optional)

### Communication/Social

- **Chat/messaging** (player communication)
- **Emotes/reactions** (quick expressions)
- **Player avatars** (visual identification)
- **Spectator count** (if applicable)

### Game History/Log

- **Event log** (recent actions: "East discarded 3 Bam", "South called Pung")
- **Discard history** (chronological order of all discards)
- **Call history** (who called what, when)
- **Turn history** (move-by-move record)

### Advanced/Optional Elements

- **Joker exchange indicator** (when you can exchange a joker from opponent's meld)
- **Safe discard hints** (tiles that can't be called)
- **Dangerous tile warnings** (tiles likely to be called/complete opponent hands)
- **Probability calculator** (odds of drawing needed tiles)
- **Tile tracker** (which tiles have been played/seen)
- **Pattern matcher** (real-time hand validation against card)

### Game Controls

- **Sort hand** (by suit/rank/custom)
- **Auto-sort toggle** (automatic organization)
- **Zoom/scale controls** (tile size)
- **Undo last action** (if allowed by rules)
- **Pause/resume** (single-player or friendly games)
- **Settings/preferences**
- **Help/rules reference**
- **Quit/leave game**

### End Game Elements

- **Winner announcement**
- **Winning hand display** (all 14 tiles)
- **Pattern matched** (which card pattern won)
- **Score breakdown** (points awarded)
- **All players' hands** (reveal at game end)
- **Replay option**
- **New game/rematch**
- **Return to lobby**

### System/Meta Elements

- **Connection status** (server connection)
- **Error messages** (validation failures, network issues)
- **Notifications** (your turn, game started, etc.)
- **Sound controls** (volume, mute)
- **Animation speed** (tile movement speed)
- **Confirmation dialogs** (are you sure?)

---

**Note**: This list represents an "ideal" comprehensive game board. Not all elements need to be visible simultaneously - many can be contextual, in menus, or togglable. This serves as a complete inventory of information a player might want or need during gameplay.

**Last Updated**: 2026-01-18
