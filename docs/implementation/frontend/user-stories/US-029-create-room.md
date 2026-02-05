# US-029: Create Room

## Story

**As a** player, **I want** to create a new game room with custom settings **So that** I can host a game with my preferred rules, card year, and bot configuration

## Acceptance Criteria

### AC-1: Create Room Button

**Given** I am on the lobby screen
**When** the lobby loads
**Then** a prominent "Create Room" button appears
**And** the button is always enabled for authenticated players

### AC-2: Room Creation Form Opens

**Given** the lobby is displayed
**When** I click "Create Room"
**Then** a room creation form modal opens
**And** the form displays all configuration sections
**And** default values are pre-filled

### AC-3: Room Name Configuration

**Given** the room creation form is open
**When** I view the "Room Name" field
**Then** a text input is displayed (max 50 characters)
**And** the placeholder shows: "My American Mahjong Game"
**And** validation indicates required field

### AC-4: Card Year Selection

**Given** the room creation form is open
**When** I view the "Card Year" dropdown
**Then** options show: 2017, 2018, 2019, 2020, 2025
**And** 2025 is selected by default
**And** a tooltip explains: "NMJL card patterns for selected year"

### AC-5: Bot Difficulty Selection

**Given** the room creation form is open
**When** I view "Fill Empty Seats with Bots" checkbox
**Then** if checked, "Bot Difficulty" dropdown appears
**And** options: Basic, Easy, Medium, Hard
**And** default is "Medium"

### AC-6: House Rules Configuration

**Given** the room creation form is open
**When** I view "House Rules" section
**Then** checkboxes appear for configurable rules (see US-034)
**And** a "Presets" dropdown shows: Standard NMJL, Beginner, Advanced

### AC-7: Timer Configuration

**Given** the room creation form is open
**When** I view "Timer Settings" section
**Then** number inputs for each phase timer (see US-036)
**And** a "Presets" dropdown: Standard, Relaxed, Blitz, No Timers

### AC-8: Submit Room Creation

**Given** I filled in room name "Friday Night Mahjong"
**When** I click "Create Room"
**Then** `CreateRoom` command sent with full config
**And** form shows loading state
**And** validation ensures required fields filled

### AC-9: Room Created Successfully

**Given** I submitted the create room form
**When** server emits `RoomCreated { room_id: "abc123" }`
**Then** I auto-join the room as East seat (host)
**And** navigate to game room/lobby view
**And** a message: "Room created successfully. Waiting for players..."

### AC-10: Room Creation Error Handling

**Given** I submit room creation but network fails
**When** no `RoomCreated` event received within 5 seconds
**Then** error toast: "Failed to create room. Retrying..."
**And** retry automatically (max 3 attempts)

## Technical Details

### Commands

```typescript
{
  CreateRoom: {
    player_id: string,
    config: {
      room_name: string,
      card_year: 2017 | 2018 | 2019 | 2020 | 2025,
      fill_with_bots: boolean,
      bot_difficulty: "Basic" | "Easy" | "Medium" | "Hard",
      house_rules: HouseRules,
      timer_config: TimerConfig
    }
  }
}
```

### Events

```typescript
{
  kind: 'Public',
  event: {
    RoomCreated: {
      room_id: string,
      host_player_id: string,
      config: RoomConfig
    }
  }
}
```

### Backend References

- `crates/mahjong_server/src/network/room.rs` - Room creation
- `crates/mahjong_core/src/table/types.rs` - Room configuration

## Components

- `<CreateRoomButton>` - Lobby button
- `<CreateRoomModal>` - Full form modal
- `<CardYearSelector>` - Year dropdown
- `<BotDifficultySelector>` - Bot settings
- `<HouseRulesSection>` - Rules checkboxes (US-034)
- `<TimerConfigSection>` - Timer inputs (US-036)

## Test Scenarios

- `tests/test-scenarios/create-room-basic.md`
- `tests/test-scenarios/create-room-custom-rules.md`

## Edge Cases

### EC-1: Duplicate Room Name

Allowed - multiple rooms can have same name (differentiated by room_id).

### EC-2: Invalid Card Year

Frontend validation prevents submission of invalid years.

### EC-3: Network Error

Retry logic with user notification.

## Related Stories

- US-030: Join Room
- US-034: House Rules
- US-036: Timer Config

## Accessibility

### Keyboard

- Tab through form fields
- Enter to submit

### Screen Reader

- "Create room form. Fill in room details."

## Priority

**CRITICAL** - Required for game start

## Story Points

**5** - Medium-High (complex form)

## Definition of Done

- [ ] Create room button on lobby
- [ ] Form modal with all sections
- [ ] Room name input (required, max 50 chars)
- [ ] Card year dropdown (2017-2025)
- [ ] Bot difficulty selector
- [ ] House rules section (US-034)
- [ ] Timer config section (US-036)
- [ ] Form validation
- [ ] Submit sends CreateRoom command
- [ ] Auto-join as East/host
- [ ] Navigate to room
- [ ] Network error handling
- [ ] Tests pass

## Notes

Form is comprehensive - delegates to US-034 and US-036 for detailed rule/timer config.

**Implementation note (2026-02-05)**: Backend currently supports `room_name`, `card_year`, and bot settings in `CreateRoom`. House rules and timer configuration remain deferred to US-034/US-036.

```text

```

```text

```
