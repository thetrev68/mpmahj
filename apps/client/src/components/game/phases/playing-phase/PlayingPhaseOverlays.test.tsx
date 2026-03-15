import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { DEFAULT_HINT_SETTINGS } from '@/lib/hintSettings';
import { gameStates } from '@/test/fixtures';
import { PlayingPhaseOverlays } from './PlayingPhaseOverlays';

vi.mock('@/components/game/DiscardAnimationLayer', () => ({
  DiscardAnimationLayer: () => <div data-testid="discard-animation-layer" />,
}));
vi.mock('@/components/game/HistoryPanel', () => ({
  HistoryPanel: () => <div data-testid="history-panel" />,
}));
vi.mock('@/components/game/JokerExchangeConfirmDialog', () => ({
  JokerExchangeConfirmDialog: () => <div data-testid="joker-exchange-confirm-dialog" />,
}));
vi.mock('@/components/game/MahjongConfirmationDialog', () => ({
  MahjongConfirmationDialog: () => <div data-testid="mahjong-confirmation-dialog" />,
}));
vi.mock('@/components/game/MahjongValidationDialog', () => ({
  MahjongValidationDialog: () => <div data-testid="mahjong-validation-dialog" />,
}));
vi.mock('@/components/game/DeadHandOverlay', () => ({
  DeadHandOverlay: () => <div data-testid="dead-hand-overlay" />,
}));
vi.mock('@/components/game/CallResolutionOverlay', () => ({
  CallResolutionOverlay: () => <div data-testid="call-resolution-overlay" />,
}));
vi.mock('@/components/game/UpgradeConfirmationDialog', () => ({
  UpgradeConfirmationDialog: () => <div data-testid="upgrade-dialog" />,
}));
vi.mock('@/components/game/HintSettingsSection', () => ({
  HintSettingsSection: () => <div data-testid="hint-settings-section" />,
}));
vi.mock('@/components/game/AudioSettingsSection', () => ({
  AudioSettingsSection: () => <div data-testid="audio-settings-section" />,
}));
vi.mock('@/components/game/AnimationSettings', () => ({
  AnimationSettings: () => <div data-testid="animation-settings" />,
}));
vi.mock('@/components/game/HistoricalViewBanner', () => ({
  HistoricalViewBanner: () => <div data-testid="historical-banner" />,
}));
vi.mock('@/components/game/TimelineScrubber', () => ({
  TimelineScrubber: () => <div data-testid="timeline-scrubber" />,
}));
vi.mock('@/components/game/ResumeConfirmationDialog', () => ({
  ResumeConfirmationDialog: () => <div data-testid="resume-dialog" />,
}));

type OverlaysProps = ComponentProps<typeof PlayingPhaseOverlays>;

function createBaseProps(): OverlaysProps {
  return {
    canDeclareMahjong: true,
    errorMessage: 'Sample error',
    gameState: {
      ...gameStates.playingDiscarding,
      your_seat: 'South',
      your_hand: [1, 2, 3],
      game_id: 'room1',
      players: [
        {
          seat: 'South',
          player_id: 'south',
          is_bot: false,
          status: 'Active',
          tile_count: 14,
          exposed_melds: [],
        },
      ],
    },
    getDuration: (ms) => ms,
    hintSystem: {
      currentHint: null,
      hintPending: false,
      hintError: null,
      cancelHintRequest: vi.fn(),
      showHintRequestDialog: false,
      setShowHintRequestDialog: vi.fn(),
      handleRequestHint: vi.fn(),
      showHintSettings: false,
      setShowHintSettings: vi.fn(),
      hintSettings: DEFAULT_HINT_SETTINGS,
      handleHintSettingsChange: vi.fn(),
      hintStatusMessage: null,
      audioSettings: {
        soundEffectsEnabled: true,
        soundEffectsVolume: 0.5,
        musicEnabled: true,
        musicVolume: 0.5,
      },
      handleSoundEffectsEnabledChange: vi.fn(),
      handleSoundEffectsVolumeChange: vi.fn(),
      handleMusicEnabledChange: vi.fn(),
      handleMusicVolumeChange: vi.fn(),
    },
    historyPlayback: {
      isHistoryOpen: false,
      setIsHistoryOpen: vi.fn(),
      history: {
        moves: [],
        filteredMoves: [],
        isLoading: false,
        error: null,
        playerFilter: 'All',
        actionFilters: new Set(),
        searchQuery: '',
        expandedMoves: new Set(),
        pulsingMoveNumber: null,
        requestCount: 0,
        setPlayerFilter: vi.fn(),
        toggleActionFilter: vi.fn(),
        setSearchQuery: vi.fn(),
        toggleExpandedMove: vi.fn(),
        exportHistory: vi.fn(),
        clearError: vi.fn(),
      },
      requestJumpToMove: vi.fn(),
      historicalMoveNumber: null,
      historyLoadingMessage: null,
      isHistoricalView: false,
      historicalDescription: '',
      canResumeFromHistory: false,
      returnToPresent: vi.fn(),
      setShowResumeDialog: vi.fn(),
      totalMoves: 0,
      showResumeDialog: false,
      isResuming: false,
      confirmResumeFromHere: vi.fn(),
      historyWarning: null,
      setHistoryWarning: vi.fn(),
    },
    isTileMovementEnabled: true,
    mahjong: {
      showMahjongDialog: false,
      mahjongDialogLoading: false,
      handleMahjongConfirm: vi.fn(),
      handleMahjongCancel: vi.fn(),
      awaitingMahjongValidation: null,
      awaitingValidationLoading: false,
      handleMahjongValidationSubmit: vi.fn(),
      mahjongDeclaredMessage: null,
      deadHandNotice: null,
      showDeadHandOverlay: false,
      deadHandOverlayData: null,
      setDeadHandOverlayVisible: vi.fn(),
    },
    meldActions: {
      pendingExchangeOpportunity: null,
      jokerExchangeLoading: false,
      inlineError: null,
      handleConfirmExchange: vi.fn(),
      handleCancelExchange: vi.fn(),
      upgradeDialogState: null,
      upgradeDialogLoading: false,
      handleUpgradeConfirm: vi.fn(),
      handleUpgradeCancel: vi.fn(),
    },
    stagedTiles: {
      incoming: [],
      outgoing: [],
      concealedAfterExcludingStaged: [],
    },
    playing: {
      resolutionOverlay: null,
      dismissResolutionOverlay: vi.fn(),
      discardAnimationTile: 5,
      setDiscardAnimation: vi.fn(),
    },
    prefersReducedMotion: false,
  };
}

describe('PlayingPhaseOverlays', () => {
  it('renders overlay surfaces without undo overlays', () => {
    const props = createBaseProps();

    render(<PlayingPhaseOverlays {...props} />);

    expect(screen.getByTestId('discard-animation-layer')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Sample error');
    expect(screen.getByTestId('mahjong-opportunity-message')).toBeInTheDocument();
    expect(screen.getByTestId('joker-exchange-confirm-dialog')).toBeInTheDocument();
    expect(screen.queryByTestId('joker-exchange-dialog')).not.toBeInTheDocument();
    expect(screen.queryByTestId('undo-notice')).not.toBeInTheDocument();
    expect(screen.queryByTestId('undo-vote-panel')).not.toBeInTheDocument();
  });

  it('does not render hint panel or loading overlay from overlays', () => {
    const props = createBaseProps();

    render(
      <PlayingPhaseOverlays
        {...props}
        hintSystem={{
          ...props.hintSystem,
          currentHint: {
            recommended_discard: 5,
            discard_reason: 'reason',
            best_patterns: [],
            tiles_needed_for_win: [],
            distance_to_win: 1,
            hot_hand: false,
            call_opportunities: [],
            defensive_hints: [],
            charleston_pass_recommendations: [],
            tile_scores: {},
            utility_scores: {},
          },
          hintPending: true,
        }}
      />
    );

    expect(screen.queryByTestId('hint-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hint-loading-overlay')).not.toBeInTheDocument();
  });

  it('removes the hint request verbosity select and still shows the request action', () => {
    const props = createBaseProps();

    render(
      <PlayingPhaseOverlays
        {...props}
        hintSystem={{ ...props.hintSystem, showHintRequestDialog: true }}
      />
    );

    expect(screen.getByTestId('hint-request-dialog')).toBeInTheDocument();
    expect(screen.queryByTestId('hint-request-verbosity-select')).not.toBeInTheDocument();
    expect(screen.getByTestId('request-analysis-button')).toBeInTheDocument();
  });

  it('renders the audio section inside the settings modal', () => {
    const props = createBaseProps();

    render(
      <PlayingPhaseOverlays
        {...props}
        hintSystem={{ ...props.hintSystem, showHintSettings: true }}
      />
    );

    expect(screen.getByTestId('hint-settings-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('hint-settings-section')).toBeInTheDocument();
    expect(screen.getByTestId('audio-settings-section')).toBeInTheDocument();
    expect(screen.getByTestId('animation-settings')).toBeInTheDocument();
  });
});
