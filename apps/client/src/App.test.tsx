import { afterEach, describe, expect, test } from 'vitest';
import { screen } from '@testing-library/react';
import { App } from './App';
import { renderWithProviders } from '@/test/test-utils';
import { useRoomStore } from '@/stores/roomStore';

const ORIGINAL_URL = window.location.href;

describe('App fixture route', () => {
  afterEach(() => {
    window.history.replaceState({}, '', ORIGINAL_URL);
    useRoomStore.setState({
      currentRoom: null,
      availableRooms: [],
      selectedRoom: null,
      roomCreation: {
        isCreating: false,
        error: null,
        retryCount: 0,
      },
      roomJoining: {
        isJoining: false,
        error: null,
      },
    });
  });

  test('renders the offline GameBoard fixture when a fixture query param is present', async () => {
    window.history.replaceState({}, '', '/?fixture=charlestonFirstRight');

    renderWithProviders(<App />);

    expect(await screen.findByTestId('game-board', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByTestId('square-board-container')).toBeInTheDocument();
  });
});
