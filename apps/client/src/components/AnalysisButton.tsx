import { useGameStore } from '@/store/gameStore';

interface AnalysisButtonProps {
  onOpen: () => void;
}

export function AnalysisButton({ onOpen }: AnalysisButtonProps) {
  const yourSeat = useGameStore((state) => state.yourSeat);
  const handSize = useGameStore((state) => state.yourHand.length);
  const isDisabled = !yourSeat || handSize === 0;

  return (
    <button onClick={onOpen} disabled={isDisabled}>
      Analyze Hand
    </button>
  );
}
