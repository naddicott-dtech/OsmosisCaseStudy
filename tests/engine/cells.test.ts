import { describe, expect, it } from 'vitest';
import { nacl_mOsm, tonicity, animalCellVolume, animalCellState, plantCellState, solutePotential } from '../../src/engine/cells';

describe('beaker cell', () => {
  it('0.9% NaCl is about 286 mOsm and isotonic', () => {
    expect(nacl_mOsm(0.9)).toBeGreaterThan(280);
    expect(nacl_mOsm(0.9)).toBeLessThan(292);
    expect(tonicity(nacl_mOsm(0.9))).toBe('isotonic');
    expect(animalCellState(animalCellVolume(nacl_mOsm(0.9)))).toBe('normal');
  });
  it('red cells lyse near 0.45% and below, swell above that', () => {
    expect(animalCellState(animalCellVolume(nacl_mOsm(0)))).toBe('lysed');
    expect(animalCellState(animalCellVolume(nacl_mOsm(0.3)))).toBe('lysed');
    expect(animalCellState(animalCellVolume(nacl_mOsm(0.6)))).toBe('swollen');
  });
  it('hypertonic solutions shrink animal cells and plasmolyze plant cells', () => {
    expect(tonicity(nacl_mOsm(3))).toBe('hypertonic');
    expect(animalCellState(animalCellVolume(nacl_mOsm(3)))).toBe('shrunken');
    expect(plantCellState(nacl_mOsm(3))).toBe('plasmolyzed');
    expect(plantCellState(nacl_mOsm(0))).toBe('turgid');
  });
});

describe('water potential', () => {
  it('Ψs = −iCRT', () => {
    expect(solutePotential(2, 0.1, 25)).toBeCloseTo(-4.955, 2);
    expect(solutePotential(2, 0, 25)).toBe(0);
  });
  it('dilute blood has higher (less negative) Ψs than brain cells', () => {
    expect(solutePotential(2, 0.11, 38.9)).toBeGreaterThan(solutePotential(2, 0.14, 38.9));
  });
});
