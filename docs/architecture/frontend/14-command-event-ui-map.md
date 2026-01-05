# 14. Command and Event UI Mapping

This document maps backend commands and events to frontend UI behavior and store updates.

## 14.1 GameCommand -> UI Trigger

| Command | UI Trigger | Validation |
| --- | --- | --- |
| `RollDice` | "Roll Dice" button (East only) | Only East can click during Setup |
| `ReadyToStart` | "Ready" button | Disable once pressed |
| `PassTiles` | Charleston "Pass" button | Exactly 3 tiles, no Jokers |
| `VoteCharleston` | Charleston vote buttons | Only during Voting stage |
| `ProposeCourtesyPass` | Courtesy pass selector | Only in CourtesyAcross |
| `AcceptCourtesyPass` | Courtesy "Confirm" | 0-3 tiles |
| `DrawTile` | Draw button | Only if `TurnStage.Drawing` and your turn |
| `DiscardTile` | Discard button | Tile must be selected |
| `CallTile` | CallWindow buttons | Only when you can act |
| `Pass` | CallWindow "Pass" | Only when you can act |
| `DeclareMahjong` | "Mahjong" button | Only in Discarding or CallWindow |
| `ExchangeJoker` | Joker exchange modal | Requires valid replacement tile |
| `ExchangeBlank` | Blank exchange modal | House rule enabled |
| `RequestState` | Auto on reconnect | None |
| `LeaveGame` | "Leave Room" | Always allowed |

## 14.2 GameEvent -> Store Updates

| Event | Store Update | UI Reaction |
| --- | --- | --- |
| `GameCreated` | set `game_id` | Show lobby room id |
| `PlayerJoined` | update `players` | Update seat list |
| `GameStarting` | set phase to Setup | Transition to GameRoom |
| `DiceRolled` | update setup state | Dice animation |
| `WallBroken` | update setup state | Wall break animation |
| `TilesDealt` | set `yourHand` | Deal animation |
| `CharlestonPhaseChanged` | set phase | Show Charleston overlay |
| `PlayerReadyForPass` | mark ready | Update ready count |
| `TilesPassing` | show pass animation | Direction arrow |
| `TilesReceived` | update hand | Add tiles |
| `PlayerVoted` | update vote state | Show progress |
| `VoteResult` | update phase | Continue/stop flow |
| `CharlestonComplete` | set phase | Remove overlay |
| `PhaseChanged` | set phase | Update UI state |
| `TurnChanged` | set turn | Turn banner |
| `TileDrawn` | update hand if tile provided | Draw animation |
| `TileDiscarded` | update discard pile | Discard animation |
| `CallWindowOpened` | set call state | Open call modal |
| `CallWindowClosed` | clear call state | Close call modal |
| `TileCalled` | update melds | Meld animation |
| `JokerExchanged` | update hands/melds | Toast |
| `BlankExchanged` | update hand | Toast |
| `MahjongDeclared` | set phase | Show scoring overlay |
| `HandValidated` | update scoring | Show pattern/invalid |
| `GameOver` | set result | Game over screen |
| `CommandRejected` | add error | Toast/error banner |

## 14.3 Envelope -> UI Mapping

| Envelope | UI Behavior |
| --- | --- |
| `AuthSuccess` | store session token, move to lobby |
| `AuthFailure` | show auth error |
| `RoomJoined` | store room id and seat |
| `RoomLeft` | return to lobby |
| `RoomClosed` | return to lobby |
| `RoomMemberLeft` | update seat list |
| `StateSnapshot` | overwrite game state |
| `Error` | show error toast/banner |
| `Ping` | reply with `Pong` |
