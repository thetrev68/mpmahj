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
  const [cardYear, setCardYear] = useState<number>(2025);
  const [fillWithBots, setFillWithBots] = useState<boolean>(false);
  const [botDifficulty, setBotDifficulty] = useState<Difficulty>('Medium');

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      setCardYear(2025);
      setFillWithBots(false);
      setBotDifficulty('Medium');
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload: CreateRoomPayload = {
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
