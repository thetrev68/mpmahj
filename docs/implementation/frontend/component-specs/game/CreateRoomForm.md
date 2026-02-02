# CreateRoomForm

## Purpose

Modal form for creating a new room with basic settings (name, timers, house rules preset).

## User Stories

- US-029: Room creation

## Props

```typescript
interface CreateRoomFormProps {
  isOpen: boolean;
  onSubmit: (payload: CreateRoomPayload) => void;
  onCancel: () => void;
}

// From bindings
interface CreateRoomPayload {
  card_year: number;
  bot_difficulty: Difficulty | null;
  fill_with_bots: boolean;
}
```

## Behavior

- Validates required fields (card year).
- Submit button disabled until valid.
- Cancel closes the modal.

## Visual Requirements

### Layout

```text
┌─────────────────────────────┐
│ Create Room                 │
│ Card Year: [2025 ▼]         │
│ Bots: [None / Easy / ...]   │
│ Fill Empty Seats: [☐]       │
│ [Cancel] [Create]           │
└─────────────────────────────┘
```

- Simple stacked inputs with actions at bottom.

## Related Components

- **Used by**: `<LobbyLayout>`
- **Uses**: shadcn/ui `<Dialog>`, `<Input>`, `<Button>`, `<Select>`

## Implementation Notes

- Advanced rules/timers are configured via room settings after creation.
