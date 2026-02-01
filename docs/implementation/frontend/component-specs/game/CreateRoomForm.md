# CreateRoomForm

## Purpose

Modal form for creating a new room with basic settings (name, timers, house rules preset).

## User Stories

- US-029: Room creation

## Props

````typescript
interface CreateRoomFormProps {
  isOpen: boolean;
  defaultName?: string;
  defaultTimerSeconds?: number;
  onSubmit: (payload: CreateRoomPayload) => void;
  onCancel: () => void;
}

interface CreateRoomPayload {
  name: string;
  timerSeconds: number;
  rulesPreset?: string;
}
```text

## Behavior

- Validates required fields (name, timer).
- Submit button disabled until valid.
- Cancel closes the modal.

## Visual Requirements

### Layout

```text
┌─────────────────────────────┐
│ Create Room                 │
│ Name: [__________]          │
│ Timer: [60] seconds         │
│ [Cancel] [Create]           │
└─────────────────────────────┘
```text

- Simple stacked inputs with actions at bottom.

## Related Components

- **Used by**: `<LobbyLayout>`
- **Uses**: shadcn/ui `<Dialog>`, `<Input>`, `<Button>`, `<Select>`

## Implementation Notes

- Keep rules presets simple; advanced rules handled in Settings.
````
