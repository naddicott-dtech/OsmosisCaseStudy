import { describe, expect, it } from 'vitest';
import { reportText } from '../../src/report';
import { createPatient } from '../../src/engine/physiology';
import type { Saved } from '../../src/state';

function saved(answers: Record<string, string>, honors = true): Saved {
  return {
    version: 1, step: 3, answers, toolsUsed: [], labFlags: {},
    labCheck: { attempts: 0, firstScore: null, done: false },
    brainPrediction: null, brainWatched: false,
    chain: { current: ['c1', 'c2'], attempts: 3, firstAttempt: ['c2', 'c1'], solved: false },
    cellSeen: { hypotonic: false, isotonic: false, hypertonic: false },
    treatments: [], trial: 1, trialEnded: false, trialResults: [], patient: createPatient(),
    runnerFlags: {}, runnerCheck: { attempts: 0, firstScore: null, done: false },
    runnerChoice: { first: null, current: null }, reduceMotion: false, honors, startedAt: '2026-09-24T09:00:00Z',
  };
}
describe('report', () => {
  it('prints the current chain as well as the first attempt', () => {
    const text = reportText(saved({}, false));
    expect(text).toContain('First attempt:');
    expect(text).toContain('Current chain:');
  });
  it('omits water potential for non-Honors students who skipped it', () => {
    expect(reportText(saved({}, false))).not.toContain('Ψs');
  });
});
