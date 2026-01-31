# Component Master List - American Mahjong Frontend

This document provides a comprehensive index of all React components, hooks, and utilities identified across the 36 user stories in [docs/implementation/frontend/user-stories](user-stories/).

## Organization

Components are organized into 5 categories:

1. **Presentational Components** - Pure UI components with minimal logic
2. **Container Components** - Smart components with business logic
3. **Integration Components** - Complex multi-component flows
4. **Hooks** - Custom React hooks for shared logic
5. **Utility Components** - Shared/reusable components

---

## 1. Presentational Components

Pure UI components that receive props and render visual elements. No direct state management or business logic.

### Core Game Elements

| Component                | Description                                    | User Stories           |
| ------------------------ | ---------------------------------------------- | ---------------------- |
| `<Tile>`                 | Single tile display with face/back, suit, rank | All gameplay stories   |
| `<DiceOverlay>`          | Dice roll animation, result display            | US-001                 |
| `<WallCounter>`          | Remaining tiles count display                  | US-001, US-009, US-017 |
| `<WallClosureIndicator>` | "WALL CLOSED" badge                            | US-017                 |
| `<TurnIndicator>`        | Highlights current player's turn               | US-009, US-010         |
| `<Timer>`                | Countdown timer display                        | US-002-007, US-036     |
| `<ActionBar>`            | Container for action buttons                   | US-001, US-009, US-010 |
| `<DiscardPool>`          | Center table showing discarded tiles           | US-010                 |
| `<PlayerSeatIndicator>`  | Player name, seat, status badge                | US-029-033             |

### Charleston Components

| Component              | Description                           | User Stories   |
| ---------------------- | ------------------------------------- | -------------- |
| `<CharlestonTracker>`  | Phase indicator with direction arrows | US-002-006     |
| `<CharlestonTimer>`    | Phase-specific timer                  | US-002-006     |
| `<TileSelectionPanel>` | Tile selection UI with counter        | US-002-004     |
| `<BlindPassPanel>`     | Blind pass slider (0-3 tiles)         | US-004, US-006 |
| `<PassAnimationLayer>` | Directional tile passing animations   | US-002-006     |
| `<IOUOverlay>`         | IOU scenario detection/resolution     | US-008         |
| `<IOUDiagram>`         | Visual circular debt diagram          | US-008         |
| `<CourtesyPassPanel>`  | Courtesy pass negotiation UI          | US-007         |
| `<SelectionCounter>`   | "X/3 selected" display                | US-002-004     |

### Call & Meld Components

| Component                      | Description                                  | User Stories |
| ------------------------------ | -------------------------------------------- | ------------ |
| `<CallWindowPanel>`            | Call intent buttons (Pung/Kong/Mahjong/Pass) | US-011       |
| `<CallResolutionOverlay>`      | Shows priority explanation                   | US-012       |
| `<PriorityDiagram>`            | Turn order visualization                     | US-012       |
| `<ExposedMeldsArea>`           | Container for exposed melds                  | US-013       |
| `<MeldDisplay>`                | Individual meld with rotated called tile     | US-013       |
| `<JokerExchangeIndicator>`     | Highlights exchangeable Jokers               | US-014       |
| `<ExchangeConfirmationDialog>` | Joker exchange confirmation                  | US-014       |
| `<UpgradeIndicator>`           | Highlights upgradeable melds                 | US-016       |
| `<UpgradeConfirmationDialog>`  | Meld upgrade confirmation                    | US-016       |
| `<ExchangeCounter>`            | "X Jokers exchanged this turn"               | US-015       |

### Mahjong & Scoring Components

| Component                     | Description                               | User Stories   |
| ----------------------------- | ----------------------------------------- | -------------- |
| `<MahjongConfirmationDialog>` | Declare Mahjong confirmation              | US-018         |
| `<MahjongValidationDialog>`   | Hand validation UI (called Mahjong)       | US-019         |
| `<CelebrationOverlay>`        | Victory animation (confetti/fireworks)    | US-018, US-019 |
| `<WinningHandDisplay>`        | Shows winning hand with pattern           | US-018, US-019 |
| `<ScoringScreen>`             | Displays scores, pattern, payments        | US-018, US-019 |
| `<GameOverPanel>`             | Post-game options (New Game/Lobby/Replay) | US-018         |
| `<DeadHandOverlay>`           | Invalid Mahjong penalty announcement      | US-020         |
| `<DeadHandBadge>`             | Red "DEAD HAND" badge                     | US-020         |
| `<RevealedHand>`              | Shows dead hand player's tiles to all     | US-020         |
| `<DrawOverlay>`               | Wall exhaustion/draw announcement         | US-021         |
| `<DrawScoringScreen>`         | Draw statistics and final scores          | US-021         |
| `<PenaltyScoreDisplay>`       | Shows forfeit penalty                     | US-032         |
| `<RevealedHandDisplay>`       | Shows forfeited player's tiles            | US-032         |

### History & Replay Components

| Component                    | Description                              | User Stories   |
| ---------------------------- | ---------------------------------------- | -------------- |
| `<UndoButton>`               | Undo with counter and tooltip            | US-022         |
| `<UndoConfirmationDialog>`   | Optional undo confirmation               | US-022         |
| `<UndoTooltip>`              | Shows recent actions                     | US-022         |
| `<UndoVotePanel>`            | Multiplayer undo voting UI               | US-023         |
| `<UndoVoteResult>`           | Vote result display                      | US-023         |
| `<MoveList>`                 | Scrollable move history list             | US-024         |
| `<MoveEntry>`                | Individual move with expand/collapse     | US-024         |
| `<HistoryFilters>`           | Filter controls (player, action type)    | US-024         |
| `<HistorySearch>`            | Search input with highlighting           | US-024         |
| `<PhaseMarker>`              | Phase separator with sticky header       | US-024         |
| `<ExportButton>`             | Export history to file                   | US-024         |
| `<HistoricalViewBanner>`     | "VIEWING HISTORY" top banner             | US-025, US-026 |
| `<TimelineScrubber>`         | Slider to navigate moves                 | US-025         |
| `<ReadOnlyOverlay>`          | Disables interactions in historical mode | US-025         |
| `<HistoricalDetailsPanel>`   | Move context and details                 | US-025         |
| `<ResumeButton>`             | "Resume from Here" button                | US-026         |
| `<ResumeConfirmationDialog>` | Resume warning dialog                    | US-026         |

### Hint & AI Components

| Component                     | Description                         | User Stories |
| ----------------------------- | ----------------------------------- | ------------ |
| `<HintButton>`                | Request hint button with counter    | US-027       |
| `<HintVerbositySelector>`     | Choose Brief/Detailed/Expert        | US-027       |
| `<HintPanel>`                 | Display AI suggestions              | US-027       |
| `<HintLoadingOverlay>`        | "AI analyzing..." animation         | US-027       |
| `<BriefHintDisplay>`          | Simple one-line suggestion          | US-027       |
| `<DetailedHintDisplay>`       | Pattern list and alternatives       | US-027       |
| `<ExpertHintDisplay>`         | Comprehensive analysis with EV      | US-027       |
| `<PatternRecommendationList>` | List of viable patterns             | US-027       |
| `<HintCounter>`               | Shows remaining hints (e.g., "2/3") | US-027       |
| `<HintCooldownTimer>`         | 30-second countdown                 | US-027       |
| `<HintSettingsSection>`       | Hint configuration UI               | US-028       |
| `<HintPreview>`               | Example for each verbosity level    | US-028       |
| `<VerbosityDropdown>`         | Select verbosity level              | US-028       |
| `<SoundSelector>`             | Choose hint sound                   | US-028       |

### Room & Lobby Components

| Component                     | Description                       | User Stories           |
| ----------------------------- | --------------------------------- | ---------------------- |
| `<CreateRoomButton>`          | Lobby button to create room       | US-029                 |
| `<CreateRoomModal>`           | Full room creation form           | US-029                 |
| `<CardYearSelector>`          | Year dropdown (2017-2025)         | US-029                 |
| `<BotDifficultySelector>`     | Bot difficulty settings           | US-029                 |
| `<HouseRulesSection>`         | House rules checkboxes            | US-029, US-034         |
| `<TimerConfigSection>`        | Timer inputs and presets          | US-029, US-036         |
| `<RoomCard>`                  | Individual room display card      | US-030                 |
| `<RoomDetailsPanel>`          | Sliding panel with full room info | US-030                 |
| `<RoomFilters>`               | Filter and sort controls          | US-030                 |
| `<SeatSelectionDialog>`       | Modal for choosing seat           | US-030                 |
| `<SeatDiagram>`               | Visual 4-seat compass layout      | US-030                 |
| `<JoinRoomButton>`            | Join action button                | US-030                 |
| `<LoadingOverlay>`            | Generic loading overlay           | US-030, US-031, US-032 |
| `<LeaveGameButton>`           | Leave game button with icon       | US-031                 |
| `<LeaveConfirmationDialog>`   | Leave confirmation modal          | US-031                 |
| `<ForfeitButton>`             | Forfeit button with warning icon  | US-032                 |
| `<ForfeitConfirmationDialog>` | Forfeit penalty warning           | US-032                 |
| `<PlayerStatusBadge>`         | "Forfeited" badge on player seat  | US-032                 |
| `<AbandonVotePanel>`          | Abandon game voting UI            | US-033                 |
| `<AbandonVoteResult>`         | Vote result display               | US-033                 |

### Settings Components

| Component                 | Description                            | User Stories                   |
| ------------------------- | -------------------------------------- | ------------------------------ |
| `<SettingsPanel>`         | Main settings UI                       | US-028, US-034, US-035, US-036 |
| `<AnimationModeSelector>` | Full/Instant/Reduced dropdown          | US-035                         |
| `<AnimationSpeedSlider>`  | Speed multiplier (0.5x-3x)             | US-035                         |
| `<AnimationToggle>`       | Individual animation enable/disable    | US-035                         |
| `<AnimationPreview>`      | Live preview of animation changes      | US-035                         |
| `<PerformanceIndicator>`  | Low FPS warning and suggestion         | US-035                         |
| `<TimerPresetSelector>`   | Standard/Relaxed/Blitz/NoTimers/Custom | US-036                         |
| `<TimerInputField>`       | Number input with validation           | US-036                         |
| `<GameDurationPreview>`   | Estimated game time display            | US-036                         |
| `<RulePresetSelector>`    | Standard/Beginner/Advanced/Custom      | US-034                         |
| `<RuleCheckbox>`          | Individual house rule toggle           | US-034                         |
| `<RuleDescription>`       | Tooltip/description for rules          | US-034                         |

### Utility/Shared Components

| Component              | Description                | User Stories                 |
| ---------------------- | -------------------------- | ---------------------------- |
| `<NotificationToast>`  | Toast messages for events  | US-031, US-032, US-033       |
| `<ErrorDialog>`        | Error message display      | All stories (error handling) |
| `<ConfirmationDialog>` | Generic confirmation modal | Multiple stories             |
| `<Tooltip>`            | Hover/focus tooltip        | Multiple stories             |
| `<Badge>`              | Status badges              | Multiple stories             |
| `<IconButton>`         | Icon-only button           | Multiple stories             |
| `<Spinner>`            | Loading spinner            | Multiple stories             |

---

## 2. Container Components

Smart components with business logic, state management, and data fetching. Coordinate between presentational components and application state.

| Component                  | Description                                         | User Stories               |
| -------------------------- | --------------------------------------------------- | -------------------------- |
| `<Wall>`                   | Wall sections with break animation, tile management | US-001                     |
| `<ConcealedHand>`          | Player's hand with selection, sorting, interaction  | US-002-004, US-009, US-010 |
| `<CharlestonFlow>`         | Orchestrates all Charleston phases                  | US-002-008                 |
| `<TurnFlow>`               | Manages draw/discard turn cycle                     | US-009, US-010             |
| `<CallFlow>`               | Call window and resolution logic                    | US-011, US-012             |
| `<MeldManager>`            | Exposed meld state and interactions                 | US-013, US-016             |
| `<JokerExchangeFlow>`      | Joker exchange logic                                | US-014, US-015             |
| `<MahjongDeclarationFlow>` | Mahjong validation and scoring                      | US-018, US-019             |
| `<HistoryPanel>`           | History viewing and management                      | US-024, US-025, US-026     |
| `<GameBoard>`              | Main game layout coordinator                        | All gameplay stories       |
| `<RoomList>`               | List of available rooms with filtering              | US-030                     |
| `<GameMenu>`               | Menu with leave/forfeit/abandon options             | US-031, US-032, US-033     |
| `<SpectatorView>`          | View for forfeited players                          | US-032                     |

---

## 3. Integration Components

Complex flows that integrate multiple container and presentational components.

| Component                    | Description                                         | User Stories |
| ---------------------------- | --------------------------------------------------- | ------------ |
| `<CharlestonIntegration>`    | Full Charleston flow (6 passes + voting + courtesy) | US-002-008   |
| `<PlayingPhaseIntegration>`  | Complete turn cycle with calls and melds            | US-009-017   |
| `<MahjongFlowIntegration>`   | Declaration through scoring                         | US-018-021   |
| `<HistoryReplayIntegration>` | Jump, view, resume from history                     | US-024-026   |
| `<RoomSetupIntegration>`     | Create/join room flow                               | US-029-030   |
| `<GameEndIntegration>`       | Leave/forfeit/abandon flows                         | US-031-033   |

---

## 4. Hooks

Custom React hooks for shared logic and state management.

| Hook                      | Description                                       | User Stories                   |
| ------------------------- | ------------------------------------------------- | ------------------------------ |
| `useSoundEffects()`       | Play sound effects (dice, discard, victory, etc.) | US-001, US-009, US-010, US-018 |
| `useTileSelection()`      | Tile selection logic for Charleston, discard      | US-002-004, US-010             |
| `useTimer()`              | Countdown timer management                        | US-002-007, US-011, US-036     |
| `useWebSocket()`          | WebSocket connection and message handling         | All stories                    |
| `useGameState()`          | Access global game state (Zustand)                | All stories                    |
| `useEventHandler()`       | Subscribe to specific game events                 | All stories                    |
| `useCommandSender()`      | Send commands to backend                          | All stories                    |
| `useAnimationDuration()`  | Calculate animation duration based on settings    | US-035                         |
| `useHistoryData()`        | Fetch and manage move history                     | US-024                         |
| `useLeaveGame()`          | Handle leave command and navigation               | US-031                         |
| `useForfeitGame()`        | Handle forfeit command and state updates          | US-032                         |
| `usePlayerStatus()`       | Track player forfeit/leave status                 | US-031, US-032                 |
| `useGameNavigation()`     | Navigate between lobby/room/game                  | US-029-031                     |
| `useLocalStorage()`       | Persist settings to local storage                 | US-028, US-035                 |
| `usePerformanceMonitor()` | Monitor FPS and suggest performance mode          | US-035                         |

---

## 5. Utility Components

Shared, reusable components used across multiple features.

| Component         | Description                                                  | User Stories                   |
| ----------------- | ------------------------------------------------------------ | ------------------------------ |
| `<Button>`        | Generic button with variants (primary/secondary/destructive) | All stories                    |
| `<Input>`         | Text input with validation                                   | US-029, US-033, US-034, US-036 |
| `<Dropdown>`      | Select dropdown                                              | US-027-029, US-034-036         |
| `<Checkbox>`      | Checkbox input                                               | US-029, US-034                 |
| `<Slider>`        | Range slider                                                 | US-004, US-035                 |
| `<Modal>`         | Generic modal dialog                                         | Multiple stories               |
| `<Panel>`         | Sliding panel (left/right)                                   | US-024, US-030                 |
| `<Grid>`          | Grid layout for tiles/cards                                  | Multiple stories               |
| `<FlexContainer>` | Flex layout wrapper                                          | Multiple stories               |
| `<Divider>`       | Visual separator                                             | Multiple stories               |
| `<Label>`         | Form label                                                   | Multiple stories               |
| `<HelperText>`    | Form helper/error text                                       | Multiple stories               |

---

## Component Specs Directory Structure

All components will have detailed specifications in:

```text
docs/implementation/frontend/component-specs/
├── presentational/
│   ├── Tile.md
│   ├── DiceOverlay.md
│   ├── WallCounter.md
│   ├── TurnIndicator.md
│   ├── CharlestonTracker.md
│   ├── [... all presentational components]
│   └── ...
├── container/
│   ├── Wall.md
│   ├── ConcealedHand.md
│   ├── CharlestonFlow.md
│   ├── TurnFlow.md
│   ├── [... all container components]
│   └── ...
├── integration/
│   ├── CharlestonIntegration.md
│   ├── PlayingPhaseIntegration.md
│   ├── [... all integration components]
│   └── ...
├── hooks/
│   ├── useSoundEffects.md
│   ├── useTileSelection.md
│   ├── useTimer.md
│   ├── [... all hooks]
│   └── ...
└── utility/
    ├── Button.md
    ├── Input.md
    ├── Dropdown.md
    ├── [... all utility components]
    └── ...
```

---

## Summary Statistics

| Category                  | Count   |
| ------------------------- | ------- |
| Presentational Components | 107     |
| Container Components      | 12      |
| Integration Components    | 6       |
| Hooks                     | 15      |
| Utility Components        | 13      |
| **TOTAL**                 | **153** |

---

## Next Steps

1. **Component Specs** - Create detailed specifications for each component (props, state, behavior, tests)
2. **Dependency Graph** - Map component dependencies and composition hierarchy
3. **Shared Libraries** - Identify opportunities for component libraries (e.g., `@mpmahj/ui-components`)
4. **Test Coverage** - Define test scenarios for each component (unit, integration, E2E)
5. **Storybook** - Set up Storybook for component development and documentation
6. **Implementation Order** - Prioritize components for TDD implementation based on user story dependencies

---

## Cross-References

- **User Stories**: [docs/implementation/frontend/user-stories/](user-stories/)
- **Architecture**: [docs/architecture/](../../architecture/)
- **Backend Events**: [crates/mahjong_core/src/event/](../../../crates/mahjong_core/src/event/)
- **Backend Commands**: [crates/mahjong_core/src/command.rs](../../../crates/mahjong_core/src/command.rs)

---

**Document Version**: 1.0
**Last Updated**: January 31, 2026
**Maintainer**: AI Assistant (based on user stories US-001 through US-036)

```

```
