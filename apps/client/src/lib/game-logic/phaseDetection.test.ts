/**
 * Tests for Phase Detection Utilities
 *
 * Pure functions for detecting and extracting game phase information
 */

import { describe, test, expect } from 'vitest';
import {
  isCharlestonPhase,
  isPlayingPhase,
  isSetupPhase,
  getCharlestonStage,
  getPlayingStage,
  getSetupStage,
} from './phaseDetection';
import type { GamePhase } from '@/types/bindings/generated/GamePhase';
import type { GameResult } from '@/types/bindings/generated/GameResult';
import type { TurnStage } from '@/types/bindings/generated/TurnStage';

const drawingStage: TurnStage = { Drawing: { player: 'East' } };
const discardingStage: TurnStage = { Discarding: { player: 'South' } };
const callWindowStage: TurnStage = {
  CallWindow: {
    tile: 0,
    discarded_by: 'West',
    can_act: ['East', 'South', 'North'],
    pending_intents: [],
    timer: 5,
  },
};
const awaitingMahjongStage: TurnStage = {
  AwaitingMahjong: {
    caller: 'North',
    tile: 1,
    discarded_by: 'East',
  },
};

const mockGameResult: GameResult = {
  winner: 'East',
  winning_pattern: 'Test Pattern',
  score_breakdown: null,
  final_scores: {},
  final_hands: {},
  next_dealer: 'South',
  end_condition: 'Win',
};

describe('isCharlestonPhase', () => {
  test('returns true for Charleston phase', () => {
    const phase: GamePhase = { Charleston: 'FirstRight' };
    expect(isCharlestonPhase(phase)).toBe(true);
  });

  test('returns true for all Charleston stages', () => {
    const stages = [
      'FirstRight',
      'FirstAcross',
      'FirstLeft',
      'VotingToContinue',
      'SecondLeft',
      'SecondAcross',
      'SecondRight',
      'CourtesyAcross',
    ] as const;

    stages.forEach((stage) => {
      const phase: GamePhase = { Charleston: stage };
      expect(isCharlestonPhase(phase)).toBe(true);
    });
  });

  test('returns false for Playing phase', () => {
    const phase: GamePhase = { Playing: drawingStage };
    expect(isCharlestonPhase(phase)).toBe(false);
  });

  test('returns false for Setup phase', () => {
    const phase: GamePhase = { Setup: 'RollingDice' };
    expect(isCharlestonPhase(phase)).toBe(false);
  });

  test('returns false for WaitingForPlayers phase', () => {
    const phase: GamePhase = 'WaitingForPlayers';
    expect(isCharlestonPhase(phase)).toBe(false);
  });

  test('returns false for GameOver phase', () => {
    const phase: GamePhase = { GameOver: mockGameResult };
    expect(isCharlestonPhase(phase)).toBe(false);
  });
});

describe('isPlayingPhase', () => {
  test('returns true for Playing phase', () => {
    const phase: GamePhase = { Playing: drawingStage };
    expect(isPlayingPhase(phase)).toBe(true);
  });

  test('returns true for all Playing stages', () => {
    const stages = [drawingStage, discardingStage, callWindowStage, awaitingMahjongStage] as const;

    stages.forEach((stage) => {
      const phase: GamePhase = { Playing: stage };
      expect(isPlayingPhase(phase)).toBe(true);
    });
  });

  test('returns false for Charleston phase', () => {
    const phase: GamePhase = { Charleston: 'FirstRight' };
    expect(isPlayingPhase(phase)).toBe(false);
  });

  test('returns false for Setup phase', () => {
    const phase: GamePhase = { Setup: 'BreakingWall' };
    expect(isPlayingPhase(phase)).toBe(false);
  });

  test('returns false for WaitingForPlayers phase', () => {
    const phase: GamePhase = 'WaitingForPlayers';
    expect(isPlayingPhase(phase)).toBe(false);
  });

  test('returns false for GameOver phase', () => {
    const phase: GamePhase = { GameOver: mockGameResult };
    expect(isPlayingPhase(phase)).toBe(false);
  });
});

describe('isSetupPhase', () => {
  test('returns true for Setup phase', () => {
    const phase: GamePhase = { Setup: 'RollingDice' };
    expect(isSetupPhase(phase)).toBe(true);
  });

  test('returns true for all Setup stages', () => {
    const stages = ['RollingDice', 'BreakingWall', 'Dealing', 'OrganizingHands'] as const;

    stages.forEach((stage) => {
      const phase: GamePhase = { Setup: stage };
      expect(isSetupPhase(phase)).toBe(true);
    });
  });

  test('returns false for Charleston phase', () => {
    const phase: GamePhase = { Charleston: 'FirstRight' };
    expect(isSetupPhase(phase)).toBe(false);
  });

  test('returns false for Playing phase', () => {
    const phase: GamePhase = { Playing: drawingStage };
    expect(isSetupPhase(phase)).toBe(false);
  });

  test('returns false for WaitingForPlayers phase', () => {
    const phase: GamePhase = 'WaitingForPlayers';
    expect(isSetupPhase(phase)).toBe(false);
  });

  test('returns false for GameOver phase', () => {
    const phase: GamePhase = { GameOver: mockGameResult };
    expect(isSetupPhase(phase)).toBe(false);
  });
});

describe('getCharlestonStage', () => {
  test('returns Charleston stage when in Charleston phase', () => {
    const phase: GamePhase = { Charleston: 'FirstRight' };
    expect(getCharlestonStage(phase)).toBe('FirstRight');
  });

  test('returns all Charleston stages correctly', () => {
    const stages = [
      'FirstRight',
      'FirstAcross',
      'FirstLeft',
      'VotingToContinue',
      'SecondLeft',
      'SecondAcross',
      'SecondRight',
      'CourtesyAcross',
    ] as const;

    stages.forEach((stage) => {
      const phase: GamePhase = { Charleston: stage };
      expect(getCharlestonStage(phase)).toBe(stage);
    });
  });

  test('returns null for non-Charleston phase', () => {
    const phases: GamePhase[] = [
      { Playing: drawingStage },
      { Setup: 'RollingDice' },
      'WaitingForPlayers',
      { GameOver: mockGameResult },
    ];

    phases.forEach((phase) => {
      expect(getCharlestonStage(phase)).toBeNull();
    });
  });
});

describe('getPlayingStage', () => {
  test('returns Playing stage when in Playing phase', () => {
    const phase: GamePhase = { Playing: drawingStage };
    expect(getPlayingStage(phase)).toEqual(drawingStage);
  });

  test('returns all Playing stages correctly', () => {
    const stages = [drawingStage, discardingStage, callWindowStage, awaitingMahjongStage] as const;

    stages.forEach((stage) => {
      const phase: GamePhase = { Playing: stage };
      expect(getPlayingStage(phase)).toEqual(stage);
    });
  });

  test('returns null for non-Playing phase', () => {
    const phases: GamePhase[] = [
      { Charleston: 'FirstRight' },
      { Setup: 'RollingDice' },
      'WaitingForPlayers',
      { GameOver: mockGameResult },
    ];

    phases.forEach((phase) => {
      expect(getPlayingStage(phase)).toBeNull();
    });
  });
});

describe('getSetupStage', () => {
  test('returns Setup stage when in Setup phase', () => {
    const phase: GamePhase = { Setup: 'RollingDice' };
    expect(getSetupStage(phase)).toBe('RollingDice');
  });

  test('returns all Setup stages correctly', () => {
    const stages = ['RollingDice', 'BreakingWall', 'Dealing', 'OrganizingHands'] as const;

    stages.forEach((stage) => {
      const phase: GamePhase = { Setup: stage };
      expect(getSetupStage(phase)).toBe(stage);
    });
  });

  test('returns null for non-Setup phase', () => {
    const phases: GamePhase[] = [
      { Charleston: 'FirstRight' },
      { Playing: drawingStage },
      'WaitingForPlayers',
      { GameOver: mockGameResult },
    ];

    phases.forEach((phase) => {
      expect(getSetupStage(phase)).toBeNull();
    });
  });
});

describe('Phase detection integration', () => {
  test('exactly one phase detector returns true for each phase', () => {
    const phases: GamePhase[] = [
      { Charleston: 'FirstRight' },
      { Playing: drawingStage },
      { Setup: 'RollingDice' },
      'WaitingForPlayers',
      { GameOver: mockGameResult },
    ];

    phases.forEach((phase) => {
      const results = [isCharlestonPhase(phase), isPlayingPhase(phase), isSetupPhase(phase)];

      // At most one should be true (or zero for string phases)
      const trueCount = results.filter((r) => r).length;
      expect(trueCount).toBeLessThanOrEqual(1);
    });
  });

  test('getters return null when corresponding is* function returns false', () => {
    const charlestonPhase: GamePhase = { Charleston: 'FirstRight' };

    expect(isPlayingPhase(charlestonPhase)).toBe(false);
    expect(getPlayingStage(charlestonPhase)).toBeNull();

    expect(isSetupPhase(charlestonPhase)).toBe(false);
    expect(getSetupStage(charlestonPhase)).toBeNull();
  });

  test('getters return stage when corresponding is* function returns true', () => {
    const charlestonPhase: GamePhase = { Charleston: 'FirstRight' };

    expect(isCharlestonPhase(charlestonPhase)).toBe(true);
    expect(getCharlestonStage(charlestonPhase)).toBe('FirstRight');
  });
});
