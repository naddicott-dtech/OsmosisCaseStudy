import { describe, expect, it } from 'vitest';
import {
  MODEL, createPatient, startInfusion, step, classifyOutcome, naChangePerLitre,
  equilibriumBrainVolume, icpFromVolume, type FluidId,
} from '../../src/engine/physiology';

function treat(fluid: FluidId, volumeL: number, minutes = 360) {
  const before = createPatient();
  let s = startInfusion(before, fluid, volumeL, 60);
  s = step(s, minutes);
  return { before, after: s, outcome: classifyOutcome(before, s) };
}

describe('baseline patient', () => {
  it('healthy sodium gives a normal brain and pressure', () => {
    const p = createPatient(MODEL.healthyNa);
    expect(p.brainVolume).toBeCloseTo(1, 3);
    expect(p.icp).toBeLessThan(15);
    expect(p.status).toBe('healthy');
  });
  it('Juniper at Na 110 has a swollen brain, high pressure, and is seizing', () => {
    const p = createPatient();
    expect(p.brainVolume).toBeGreaterThan(1.03);
    expect(p.icp).toBeGreaterThan(MODEL.seizeAboveICP);
    expect(p.status).toBe('seizing');
  });
  it('lower sodium means more swelling (monotonic)', () => {
    let prev = 0;
    for (let na = 150; na >= 100; na -= 5) {
      const v = equilibriumBrainVolume(na);
      expect(v).toBeGreaterThan(prev);
      prev = v;
      expect(icpFromVolume(v)).toBeGreaterThan(0);
    }
  });
});

describe('water flux direction', () => {
  it('water moves INTO the brain when plasma sodium drops', () => {
    const healthy = createPatient(140);
    const s = step(healthy, 1, 110);
    expect(s.flux).toBeGreaterThan(0);
    expect(s.brainVolume).toBeGreaterThan(healthy.brainVolume);
  });
  it('water moves OUT of a swollen brain when plasma sodium rises', () => {
    const s = step(createPatient(110), 1, 120);
    expect(s.flux).toBeLessThan(0);
  });
  it('replaying the fall from 140 to 110 ends near the seizing equilibrium', () => {
    let s = createPatient(140);
    for (let t = 0; t < 120; t++) s = step(s, 1, 140 - (30 * Math.min(t, 60)) / 60);
    expect(s.status).toBe('seizing');
    expect(s.brainVolume).toBeCloseTo(equilibriumBrainVolume(110), 3);
  });
});

describe('treatments', () => {
  it('Na change per litre follows the infusate concentration', () => {
    const tbw = MODEL.bodyMassKg * MODEL.tbwFraction;
    expect(naChangePerLitre('d5w', 110, tbw)).toBeLessThan(0);
    expect(naChangePerLitre('saline_0_9', 110, tbw)).toBeGreaterThan(0);
    expect(naChangePerLitre('saline_3', 110, tbw)).toBeGreaterThan(naChangePerLitre('saline_0_9', 110, tbw) * 5);
  });
  it('sterile water makes things worse and causes hemolysis', () => {
    const { after, outcome } = treat('sterile_water', 1);
    expect(outcome.kind).toBe('worse');
    expect(after.hemolysis).toBe(true);
    expect(after.plasmaNa).toBeLessThan(110);
  });
  it('D5W makes things worse without hemolysis', () => {
    const { after, outcome } = treat('d5w', 1);
    expect(outcome.kind).toBe('worse');
    expect(after.hemolysis).toBe(false);
    expect(['seizing', 'critical']).toContain(after.status);
  });
  it('1 L normal saline raises sodium slightly but seizures continue', () => {
    const { after, outcome } = treat('saline_0_9', 1);
    expect(after.plasmaNa).toBeGreaterThan(110);
    expect(after.plasmaNa).toBeLessThan(113);
    expect(after.status).toBe('seizing');
    expect(['partial', 'no_help']).toContain(outcome.kind);
  });
  it('0.25 L of 3% helps but is not enough alone', () => {
    const { after, outcome } = treat('saline_3', 0.25);
    expect(outcome.kind).toBe('partial');
    expect(after.status).toBe('seizing');
  });
  it('0.5 L of 3% stops seizures safely', () => {
    const { after, outcome } = treat('saline_3', 0.5);
    expect(outcome.kind).toBe('success');
    expect(after.overcorrected).toBe(false);
    expect(after.plasmaNa - 110).toBeLessThanOrEqual(MODEL.maxSafeRise24h);
  });
  it('two 0.25 L doses of 3% also succeed (cumulative)', () => {
    const before = createPatient();
    let s = step(startInfusion(before, 'saline_3', 0.25), 120);
    s = step(startInfusion(s, 'saline_3', 0.25), 240);
    expect(classifyOutcome(before, s).kind).toBe('success');
  });
  it('1 L of 3% stops seizures but overcorrects', () => {
    const { after, outcome } = treat('saline_3', 1);
    expect(outcome.kind).toBe('overcorrected');
    expect(['stable', 'healthy']).toContain(after.status);
  });
  it('stays finite over a long run of repeated doses', () => {
    let s = createPatient();
    const fluids: FluidId[] = ['sterile_water', 'd5w', 'saline_0_9', 'saline_3'];
    for (let i = 0; i < 40; i++) s = step(startInfusion(s, fluids[i % 4], 2), 250);
    for (const v of [s.plasmaNa, s.brainVolume, s.icp, s.flux, s.tbwL]) expect(Number.isFinite(v)).toBe(true);
  });
});

import { trialVerdict } from '../../src/engine/physiology';

describe('trial verdicts', () => {
  const run = (orders: [FluidId, number][]) => {
    let s = createPatient();
    for (const [f, v] of orders) s = step(startInfusion(s, f, v), 360);
    return trialVerdict(s);
  };
  it('500 mL of 3% is a safe stabilization', () => {
    expect(run([['saline_3', 0.5]]).verdict).toBe('safe');
  });
  it('1 L of 3% overcorrects', () => {
    expect(run([['saline_3', 1]]).verdict).toBe('overcorrected');
  });
  it('normal saline alone does not stabilize', () => {
    expect(run([['saline_0_9', 1]]).verdict).toBe('not_stabilized');
  });
  it('sterile water is harmful', () => {
    expect(run([['sterile_water', 0.25]]).verdict).toBe('harmed');
  });
  it('chasing normal sodium with repeated doses overcorrects', () => {
    expect(run([['saline_3', 0.5], ['saline_3', 0.5]]).verdict).toBe('overcorrected');
  });
});
