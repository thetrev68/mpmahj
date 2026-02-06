/**
 * CreateRoomForm Component
 *
 * Modal form for creating a new room with basic settings (card year, bots)
 *
 * User Story: US-029 - Create Room
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import type { Difficulty } from '@/types/bindings/generated/Difficulty';
import type { CreateRoomPayload } from '@/types/bindings/generated/CreateRoomPayload';

/**
 * Available card years
 */
const CARD_YEARS = [2017, 2018, 2019, 2020, 2025] as const;

/**
 * Available bot difficulties
 */
const BOT_DIFFICULTIES: Difficulty[] = ['Easy', 'Medium', 'Hard', 'Expert'];

const DEFAULT_ROOM_NAME = 'My American Mahjong Game';

/**
 * CreateRoomForm Props
 */
export interface CreateRoomFormProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Called when form is submitted */
  onSubmit: (payload: CreateRoomPayload) => void;
  /** Called when form is cancelled */
  onCancel: () => void;
  /** Whether the form is currently submitting */
  isSubmitting?: boolean;
}

/**
 * CreateRoomForm Component
 */
export function CreateRoomForm({ isOpen, onSubmit, onCancel, isSubmitting = false }: CreateRoomFormProps) {
  const [roomName, setRoomName] = useState<string>(DEFAULT_ROOM_NAME);
  const [cardYear, setCardYear] = useState<number>(2025);
  const [fillWithBots, setFillWithBots] = useState<boolean>(false);
  const [botDifficulty, setBotDifficulty] = useState<Difficulty>('Medium');

  // Reset form when opened - legitimate pattern for modal form reset
  useEffect(() => {
    if (isOpen) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setRoomName(DEFAULT_ROOM_NAME);
      setCardYear(2025);
      setFillWithBots(false);
      setBotDifficulty('Medium');
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [isOpen]);

  const trimmedRoomName = roomName.trim();
  const isRoomNameValid = trimmedRoomName.length > 0 && trimmedRoomName.length <= 50;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isRoomNameValid) {
      return;
    }

    const payload: CreateRoomPayload = {
      room_name: trimmedRoomName,
      card_year: cardYear,
      fill_with_bots: fillWithBots,
      bot_difficulty: fillWithBots ? botDifficulty : null,
    };

    onSubmit(payload);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Room</DialogTitle>
          <DialogDescription>
            Configure your game room settings. Click create when you're ready.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Room Name */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="room-name" className="text-right">
                Room Name
              </Label>
              <div className="col-span-3 space-y-1">
                <Input
                  id="room-name"
                  value={roomName}
                  onChange={(event) => setRoomName(event.target.value)}
                  placeholder={DEFAULT_ROOM_NAME}
                  maxLength={50}
                  disabled={isSubmitting}
                  aria-invalid={!isRoomNameValid}
                />
                {!isRoomNameValid && (
                  <p className="text-sm text-destructive">Room name is required (max 50 characters).</p>
                )}
              </div>
            </div>

            {/* Card Year Selection */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="card-year" className="text-right">
                Card Year
              </Label>
              <Select
                value={cardYear.toString()}
                onValueChange={(value) => setCardYear(Number(value))}
                disabled={isSubmitting}
              >
                <SelectTrigger className="col-span-3" id="card-year">
                  <SelectValue placeholder="Select card year" />
                </SelectTrigger>
                <SelectContent>
                  {CARD_YEARS.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Fill with Bots Checkbox */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="fill-bots"
                checked={fillWithBots}
                onCheckedChange={(checked) => setFillWithBots(checked === true)}
                disabled={isSubmitting}
              />
              <Label
                htmlFor="fill-bots"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Fill empty seats with bots
              </Label>
            </div>

            {/* Bot Difficulty (conditional) */}
            {fillWithBots && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="bot-difficulty" className="text-right">
                  Bot Difficulty
                </Label>
                <Select
                  value={botDifficulty}
                  onValueChange={(value) => setBotDifficulty(value as Difficulty)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="col-span-3" id="bot-difficulty">
                    <SelectValue placeholder="Select difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    {BOT_DIFFICULTIES.map((difficulty) => (
                      <SelectItem key={difficulty} value={difficulty}>
                        {difficulty}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !isRoomNameValid}>
              {isSubmitting ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
