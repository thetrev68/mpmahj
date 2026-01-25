/**
 * Game Menu
 *
 * Centralized game menu with exit options:
 * - Leave Game
 * - Forfeit Game
 * - Abandon Game
 */

import { useUIStore } from '@/store/uiStore';
import './GameMenu.css';

export function GameMenu() {
  const showGameMenu = useUIStore((state) => state.showGameMenu);
  const setShowGameMenu = useUIStore((state) => state.setShowGameMenu);
  const setShowHistoryPanel = useUIStore((state) => state.setShowHistoryPanel);
  const setShowLeaveConfirmation = useUIStore((state) => state.setShowLeaveConfirmation);
  const setShowForfeitDialog = useUIStore((state) => state.setShowForfeitDialog);
  const setShowAbandonDialog = useUIStore((state) => state.setShowAbandonDialog);

  const handleViewHistoryClick = () => {
    setShowGameMenu(false);
    setShowHistoryPanel(true);
  };

  const handleLeaveClick = () => {
    setShowGameMenu(false);
    setShowLeaveConfirmation(true);
  };

  const handleForfeitClick = () => {
    setShowGameMenu(false);
    setShowForfeitDialog(true);
  };

  const handleAbandonClick = () => {
    setShowGameMenu(false);
    setShowAbandonDialog(true);
  };

  const handleCloseMenu = () => {
    setShowGameMenu(false);
  };

  if (!showGameMenu) {
    return null;
  }

  return (
    <>
      {/* Backdrop to close menu when clicking outside */}
      <div className="game-menu-backdrop" onClick={handleCloseMenu}></div>

      {/* Menu dropdown */}
      <div className="game-menu">
        <div className="game-menu-header">
          <h3>Game Menu</h3>
          <button className="game-menu-close" onClick={handleCloseMenu}>
            ×
          </button>
        </div>

        <div className="game-menu-items">
          <button className="game-menu-item" onClick={handleViewHistoryClick}>
            View History
          </button>

          <button className="game-menu-item" onClick={handleLeaveClick}>
            Leave Game
          </button>

          <button className="game-menu-item" onClick={handleForfeitClick}>
            Forfeit Game
          </button>

          <button className="game-menu-item" onClick={handleAbandonClick}>
            Abandon Game
          </button>
        </div>
      </div>
    </>
  );
}
