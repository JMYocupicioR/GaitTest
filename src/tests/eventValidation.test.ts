import { describe, expect, it } from 'vitest';
import type { GaitEvent } from '../types/session.ts';
import {
  ensureEventReviewFields,
  isEventProtectedFromAutoSync,
  validateGaitEvents,
} from '../lib/eventValidation.ts';

function makeEvent(
  id: string,
  timestamp: number,
  foot: 'L' | 'R',
  type: GaitEvent['type'] = 'heel_strike',
): GaitEvent {
  return ensureEventReviewFields({
    id,
    timestamp,
    foot,
    type,
    source: 'manual',
    confidence: 0.9,
    reviewStatus: 'pending',
    reviewedAtIso: null,
    reviewedBy: null,
    qualityFlags: [],
    frameIndex: null,
    cycleId: null,
    clinicalNote: null,
    userEdited: false,
  });
}

describe('eventValidation', () => {
  it('marks sequence as ready when both sides have enough heel strikes', () => {
    const events = [
      makeEvent('L1', 0.2, 'L', 'heel_strike'),
      makeEvent('R1', 0.7, 'R', 'heel_strike'),
      makeEvent('L_TO', 0.9, 'L', 'toe_off'),
      makeEvent('L2', 1.3, 'L', 'heel_strike'),
      makeEvent('R_TO', 1.5, 'R', 'toe_off'),
      makeEvent('R2', 1.9, 'R', 'heel_strike'),
    ];

    const validation = validateGaitEvents(events, { durationSeconds: 2.1 });
    expect(validation.isReady).toBe(true);
    expect(validation.issues.length).toBe(0);
    expect(validation.cycleCount).toBeGreaterThan(0);
  });

  it('flags duplicates and events outside video duration', () => {
    const events = [
      makeEvent('L1', 0.2, 'L'),
      makeEvent('L1_DUP', 0.25, 'L'),
      makeEvent('R1', 0.8, 'R'),
      makeEvent('L2', 1.3, 'L'),
      makeEvent('R2', 1.9, 'R'),
      makeEvent('OUTSIDE', 4.2, 'L'),
    ];

    const validation = validateGaitEvents(events, { durationSeconds: 2.0 });
    expect(validation.isReady).toBe(false);
    expect(validation.issues.some((issue) => issue.includes('duración del video'))).toBe(true);
    expect(validation.flaggedEventIds).toContain('L1_DUP');
    expect(validation.flaggedEventIds).toContain('OUTSIDE');
  });

  it('detects protected events for manual review preservation', () => {
    const autoEvent = ensureEventReviewFields({
      ...makeEvent('AUTO', 1.1, 'L'),
      source: 'auto',
      userEdited: false,
      clinicalNote: null,
      reviewStatus: 'pending',
    });
    const protectedEvent = ensureEventReviewFields({
      ...makeEvent('PROTECTED', 1.3, 'L'),
      source: 'auto',
      userEdited: true,
      reviewStatus: 'confirmed',
      clinicalNote: 'ajuste clínico',
    });

    expect(isEventProtectedFromAutoSync(autoEvent)).toBe(false);
    expect(isEventProtectedFromAutoSync(protectedEvent)).toBe(true);
  });
});
