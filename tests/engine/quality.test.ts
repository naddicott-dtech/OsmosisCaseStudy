import { describe, expect, it } from 'vitest';
import { assessAnswer, RULES, hasKeyword } from '../../src/quality';

const good = 'Her blood has less sodium than her brain cells, so by osmosis more water moves into the brain cells and they swell.';

describe('answer quality check', () => {
  it('accepts a real explanation', () => {
    expect(assessAnswer(good, RULES.brain_explain).ok).toBe(true);
  });
  it.each([
    ['repeated character', 'a'.repeat(80)],
    ['repeated words', 'water water water water water water water water water water water water water water water water'],
    ['keyboard mash', 'asdf jkl qwer zxcv sdfg hjkl wert xcvb asdfgh jklqw'],
    ['too short', 'water goes in'],
    ['no function words', 'osmosis sodium brain water cells swelling aquaporin membrane solute pressure concentration'],
    ['letter spam with spaces', 'aaa bbb ccc ddd eee fff ggg hhh iii jjj kkk lll mmm nnn ooo ppp'],
  ])('rejects %s', (_label, text) => {
    expect(assessAnswer(text, RULES.brain_explain).ok).toBe(false);
  });
  it('requires a topic word when the prompt has keywords', () => {
    const r = assessAnswer('I think that it is because of the thing that happened to her on the farm yesterday morning.', RULES.brain_explain);
    expect(r.ok).toBe(false);
    expect(r.hint).toMatch(/science idea/);
  });
  it('rejects an answer that only parrots the question', () => {
    const q = 'Why does more water move into the brain than out of it';
    expect(assessAnswer('why does more water move into the brain than out of it why does', { minWords: 8, prompt: q }).ok).toBe(false);
  });
  it('short keywords match whole words only', () => {
    expect(hasKeyword('the final answer', 'na')).toBe(false);
    expect(hasKeyword('low na in blood', 'na')).toBe(true);
    expect(hasKeyword('she was dehydrated', 'dehydrat')).toBe(true);
  });
  it('accepts numbers and chemical notation as words', () => {
    expect(assessAnswer('Her sodium was 110, which is below the range of 134 to 144, so it is low.', RULES.labs_link).ok).toBe(true);
  });
});
