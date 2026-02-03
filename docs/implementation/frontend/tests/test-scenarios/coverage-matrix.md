# Test Scenario Coverage Matrix

| US | Story | Covered | Scenarios |
|---|---|---|---|
| US-001 | Roll Dice & Break Wall | Yes | roll-dice-break-wall.md |
| US-002 | Charleston First Right | Yes | charleston-standard.md |
| US-003 | Charleston First Across | Yes | charleston-first-across.md |
| US-004 | Charleston First Left (Blind Pass) | Yes | charleston-blind-pass.md |
| US-005 | Charleston Voting (Stop/Continue) | Yes | charleston-voting.md |
| US-006 | Charleston Second Charleston (Optional) | Yes | charleston-second-charleston.md |
| US-007 | Courtesy Pass Negotiation | Yes | charleston-courtesy-pass.md |
| US-008 | Charleston IOU Detection (Edge Case) | Yes | charleston-iou.md |
| US-009 | Drawing a Tile | Yes | drawing-discarding.md |
| US-010 | Discarding a Tile | Yes | drawing-discarding.md |
| US-011 | Call Window & Intent Buffering | Yes | call-window-intent-buffering.md |
| US-012 | Call Priority Resolution | Yes | calling-priority-mahjong.md, calling-priority-turn-order.md |
| US-013 | Calling Pung/Kong/Quint/Sextet | Yes | calling-pung-kong-quint-sextet.md |
| US-014 | Exchanging Joker (Single) | Yes | joker-exchange-single.md |
| US-015 | Exchanging Joker (Multiple in One Turn) | Yes | joker-exchange-multiple.md |
| US-016 | Upgrading Meld (Pung → Kong → Quint) | Yes | meld-upgrade.md |
| US-017 | Wall Closure Rule | Yes | wall-closure-rule.md |
| US-018 | Declaring Mahjong (Self-Draw) | Yes | mahjong-self-draw.md |
| US-019 | Declaring Mahjong (Called Discard) | Yes | calling-priority-mahjong.md, mahjong-called.md |
| US-020 | Invalid Mahjong → Dead Hand | Yes | dead-hand-tile-count.md, mahjong-invalid.md |
| US-021 | Wall Game (Draw) | Yes | wall-game.md |
| US-022 | Smart Undo (Solo - Immediate) | Yes | undo-solo.md |
| US-023 | Smart Undo (Voting - Multiplayer) | Yes | undo-voting.md |
| US-024 | View Move History | Yes | view-move-history.md |
| US-025 | Jump to Historical Move | Yes | history-jump.md |
| US-026 | Resume from History Point | Yes | history-resume.md |
| US-027 | Request Hints (AI Analysis) | Yes | request-hints-ai-analysis.md |
| US-028 | Adjust Hint Verbosity | Yes | adjust-hint-verbosity.md |
| US-029 | Create Room | Yes | create-room.md (Server Envelope) |
| US-030 | Join Room | Yes | join-room.md (Server Envelope) |
| US-031 | Leave Game | Yes | leave-game.md |
| US-032 | Forfeit Game | Yes | forfeit-game.md |
| US-033 | Abandon Game (Consensus) | Not Implemented | ~~abandon-game-consensus.md~~ (Deleted - voting system doesn't exist) |
| US-034 | Configure House Rules | Not Implemented | ~~configure-house-rules.md~~ (Deleted - house rules system doesn't exist) |
| US-035 | Animation Settings | Not Implemented | ~~animation-settings.md~~ (Deleted - settings commands don't exist) |
| US-036 | Timer Configuration | Yes | timer-expiry.md |
| US-037 | Disconnect Reconnect | Yes | disconnect-reconnect.md |
