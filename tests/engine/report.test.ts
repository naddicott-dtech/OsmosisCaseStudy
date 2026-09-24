import { describe, expect, it } from 'vitest';
import { progressList, psiComplete, reportText } from '../../src/report';
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
const ok = (s: Saved) => (id: string) => !!s.answers[id]?.trim();
const CALC = 'Ψs = −(2)(0.110)(0.0831)(312.05) = −5.70 bar';

describe('Honors water potential completion', () => {
  it('needs both calculations and a direction', () => {
    const s = saved({ lab_psi_blood: CALC, lab_psi_cell: CALC });
    expect(psiComplete(s, ok(s))).toBe(false);
    s.answers.lab_psi_dir = 'blood_to_brain';
    expect(psiComplete(s, ok(s))).toBe(true);
  });
  it('still accepts the retired single answer from students mid-case', () => {
    const s = saved({ lab_psi: 'Water moves from the blood into the brain cells because blood has a higher, less negative water potential.' });
    expect(psiComplete(s, ok(s))).toBe(true);
    expect(progressList(s).find((p) => p.label.includes('Honors'))?.done).toBe(false); // labs 1 & 2 not done
    expect(reportText(s)).toContain('Use your water potential values');
  });
});

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
