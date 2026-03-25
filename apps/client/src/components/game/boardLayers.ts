/**
 * Central z-index scale for board-local surfaces.
 *
 * Keep board components on this scale instead of introducing ad hoc values.
 * This mirrors the Charleston board geometry compact spec.
 */
export const BOARD_LAYERS = {
  background: 'z-0',
  gameplay: 'z-10',
  chrome: 'z-20',
  overlay: 'z-30',
  viewportOverlay: 'z-50',
  interactionLock: 'z-[60]',
} as const;
