import { describe, expect, it } from 'vitest';
import { createChamber, addParticles, stepChamber, count, waterLevel, type MembraneMode } from '../../src/engine/chamber';

function run(mode: MembraneMode, steps = 1500) {
  let c = createChamber(42, 50, mode);
  c = addParticles(c, 'sodium', 'left', 15);
  c = addParticles(c, 'oxygen', 'left', 12);
  for (let i = 0; i < steps; i++) c = stepChamber(c, 1 / 30);
  return c;
}

describe('membrane chamber', () => {
  it('aquaporin membrane: sodium trapped, water rises on sodium side', () => {
    const c = run('aquaporin');
    expect(count(c, 'sodium', 'right')).toBe(0);
    expect(waterLevel(c, 'left')).toBeGreaterThan(waterLevel(c, 'right'));
    expect(c.crossings.toLeft).toBeGreaterThan(c.crossings.toRight);
  });
  it('oxygen crosses the lipid bilayer in every mode', () => {
    for (const mode of ['bilayer', 'aquaporin', 'leaky'] as MembraneMode[]) {
      expect(count(run(mode, 800), 'oxygen', 'right')).toBeGreaterThan(0);
    }
  });
  it('bilayer only: water crosses far less than with aquaporins', () => {
    const b = run('bilayer', 800);
    const a = run('aquaporin', 800);
    expect(b.crossings.toLeft + b.crossings.toRight).toBeLessThan((a.crossings.toLeft + a.crossings.toRight) / 2);
  });
  it('leaky membrane: sodium spreads to both sides', () => {
    const c = run('leaky');
    expect(count(c, 'sodium', 'right')).toBeGreaterThan(3);
  });
  it('particles stay in the box', () => {
    const c = run('aquaporin', 600);
    for (const p of c.particles) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(1);
    }
  });
});
