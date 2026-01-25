import { useUndoState } from '@/hooks/useUndoState';
import './UndoAnimation.css';

export function UndoAnimation() {
  const { isExecuting } = useUndoState();

  if (!isExecuting) {
    return null;
  }

  return (
    <div className="undo-animation">
      <div className="undo-animation-content">Undoing... Rewinding game state.</div>
    </div>
  );
}
