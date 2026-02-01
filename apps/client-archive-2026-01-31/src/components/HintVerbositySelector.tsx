import { useState } from 'react';
import type { ChangeEvent } from 'react';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { HintVerbosity } from '@/types/bindings/generated/HintVerbosity';
import { useGameStore } from '@/store/gameStore';
import { Commands } from '@/utils/commands';

interface HintVerbositySelectorProps {
  sendCommand: (command: GameCommand) => boolean;
}

const VERBOSITY_OPTIONS: HintVerbosity[] = ['Disabled', 'Beginner', 'Intermediate', 'Expert'];

export function HintVerbositySelector({ sendCommand }: HintVerbositySelectorProps) {
  const yourSeat = useGameStore((state) => state.yourSeat);
  const [verbosity, setVerbosity] = useState<HintVerbosity>('Beginner');

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as HintVerbosity;
    setVerbosity(value);

    if (!yourSeat) {
      return;
    }

    sendCommand(Commands.setHintVerbosity(yourSeat, value));
  };

  return (
    <div className="form-group" style={{ marginBottom: 0 }}>
      <label htmlFor="hint-verbosity-select">Hint Level</label>
      <select
        id="hint-verbosity-select"
        value={verbosity}
        onChange={handleChange}
        disabled={!yourSeat}
      >
        {VERBOSITY_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <div style={{ fontSize: '0.9rem', marginTop: 4 }}>Current: {verbosity}</div>
    </div>
  );
}
