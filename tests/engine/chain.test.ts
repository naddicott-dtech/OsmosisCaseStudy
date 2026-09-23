import { describe, expect, it } from 'vitest';
import { evaluateChain } from '../../src/chain';

describe('causal chain evaluation', () => {
  it('accepts the full chain in order', () => {
    expect(evaluateChain(['c1', 'c2', 'c3', 'c4', 'c5', 'c6']).ok).toBe(true);
  });
  it('a chain that is in order but missing a link is NOT called out of order', () => {
    const fb = evaluateChain(['c1', 'c3', 'c4', 'c5', 'c6']);
    expect(fb.ok).toBe(false);
    expect(fb.messages.join(' ')).toMatch(/right order/);
    expect(fb.messages.join(' ')).toMatch(/missing between them/);
    expect(fb.messages.join(' ')).not.toMatch(/wrong order/);
    expect(fb.flagged).toEqual([0, 1]);
  });
  it('missing the ending or beginning is reported as such', () => {
    expect(evaluateChain(['c1', 'c2', 'c3', 'c4']).messages.join(' ')).toMatch(/stops early/);
    expect(evaluateChain(['c2', 'c3', 'c4', 'c5', 'c6']).messages.join(' ')).toMatch(/before your first link/);
  });
  it('a swapped pair is reported as wrong order, naming both links', () => {
    const fb = evaluateChain(['c1', 'c3', 'c2', 'c4', 'c5', 'c6']);
    expect(fb.messages[0]).toMatch(/Links 2 and 3 are in the wrong order/);
    expect(fb.flagged).toEqual([1, 2]);
  });
  it('distractors get their own misconception feedback', () => {
    const fb = evaluateChain(['c1', 'c2', 'd4', 'c3']);
    expect(fb.ok).toBe(false);
    expect(fb.messages[0]).toMatch(/38\.9/);
    expect(fb.flagged).toEqual([2]);
  });
  it('an empty chain is not ok', () => {
    expect(evaluateChain([]).ok).toBe(false);
  });
});
