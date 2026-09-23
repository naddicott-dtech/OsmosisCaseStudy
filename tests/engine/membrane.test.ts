import { describe, expect, it } from 'vitest';
import { createChamber, step, count, level, recent, type Mode, type Preset } from '../../src/engine/membrane';

function run(mode: Mode, preset: Preset, seconds: number, seed = 3) {
  const w = createChamber(mode, preset, seed);
  for (let i = 0; i < seconds * 30; i++) step(w, 1 / 30);
  return w;
}

describe('membrane chamber (macro levels + sample)', () => {
  it('salty side gains water through aquaporins and settles higher', () => {
    const w = run('aquaporin', 'salt_left', 90);
    expect(level(w, 0) - level(w, 1)).toBeGreaterThan(0.1);
  });
  it('mirror image: salt on the right raises the right side', () => {
    const w = run('aquaporin', 'salt_right', 90);
    expect(level(w, 1) - level(w, 0)).toBeGreaterThan(0.1);
  });
  it('pure water on both sides stays level (no jitter in the level)', () => {
    const w = createChamber('aquaporin', 'pure', 5);
    let maxDev = 0;
    for (let i = 0; i < 30 * 60; i++) {
      step(w, 1 / 30);
      maxDev = Math.max(maxDev, Math.abs(level(w, 0) - level(w, 1)));
    }
    expect(maxDev).toBeLessThan(0.005);
  });
  it('bilayer-only membrane: same direction, much slower', () => {
    const a = run('aquaporin', 'salt_left', 20);
    const b = run('bilayer', 'salt_left', 20);
    const da = level(a, 0) - level(a, 1);
    const db = level(b, 0) - level(b, 1);
    expect(db).toBeGreaterThan(0);
    expect(db).toBeLessThan(da / 2);
  });
  it('water crosses through the bilayer as well as aquaporins, in both directions', () => {
    const w = run('aquaporin', 'salt_left', 40);
    expect(w.crossings.bilayer[0] + w.crossings.bilayer[1]).toBeGreaterThan(5);
    expect(w.crossings.channel[0]).toBeGreaterThan(20);
    expect(w.crossings.channel[1]).toBeGreaterThan(20);
  });
  it('ions never cross an intact membrane', () => {
    for (const mode of ['bilayer', 'aquaporin'] as Mode[]) {
      const w = run(mode, 'salt_left', 30);
      expect(count(w, 'ions', 1)).toBe(0);
    }
  });
  it('leaky membrane: ions spread out and the levels even out', () => {
    const w = run('leaky', 'salt_left', 180);
    expect(count(w, 'ions', 1)).toBeGreaterThan(10);
    expect(Math.abs(level(w, 0) - level(w, 1))).toBeLessThan(0.03);
  });
  it('the dot sample stays in step with the macro counts', () => {
    const w = run('aquaporin', 'very_salty_left', 60);
    for (const s of [0, 1] as const) expect(Math.abs(count(w, 'water', s) - w.macro.water[s])).toBeLessThan(10);
  });
  it('molecules stay inside the box', () => {
    const w = run('leaky', 'salt_left', 30);
    for (const p of w.particles) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(w.o.width);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(w.o.height);
    }
    expect(recent(w, 10).toLeft + recent(w, 10).toRight).toBeGreaterThan(0);
  });
});
