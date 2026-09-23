// Two-compartment teaching model: whole-body water (plasma sodium) and brain tissue.
// Pure and deterministic — no DOM. All numbers are model rules chosen to be
// physiologically plausible, not clinical reference values. See MODEL.md.

export const MODEL = {
  bodyMassKg: 45,
  tbwFraction: 0.7,
  /** Non-sodium plasma osmoles (glucose + urea), mOsm/kg. */
  otherOsmoles: 15,
  /** Brain cell solute content, scaled so a brain at plasma Na 140 has volume 1.0. */
  brainSolute: 2 * 140 + 15,
  /** Tissue/skull resistance to swelling, in mOsm-equivalents per unit relative volume. */
  elasticity: 700,
  /** Water permeability of the blood–brain barrier (per min per mOsm). Time constant ≈ 10 min. */
  permeability: 1e-4,
  icpBase: 4,
  icpScale: 1,
  icpSteepness: 0.55,
  seizeAboveICP: 25,
  stableAtOrBelowICP: 20,
  criticalAboveICP: 40,
  /** Rise in plasma Na (mEq/L) within 24 h beyond which osmotic demyelination risk is flagged. */
  maxSafeRise24h: 10,
  healthyNa: 140,
  initialNa: 110,
} as const;

export type FluidId = 'sterile_water' | 'd5w' | 'saline_0_9' | 'saline_3';

export interface Fluid {
  id: FluidId;
  name: string;
  short: string;
  naMEqPerL: number;
  /** Given IV in real clinical practice? */
  clinical: boolean;
  note: string;
}

export const FLUIDS: Record<FluidId, Fluid> = {
  sterile_water: {
    id: 'sterile_water',
    name: 'Sterile water (0% NaCl)',
    short: 'Sterile water',
    naMEqPerL: 0,
    clinical: false,
    note: 'Thought experiment only — never given straight into a vein.',
  },
  d5w: {
    id: 'd5w',
    name: 'D5W (5% dextrose in water)',
    short: 'D5W',
    naMEqPerL: 0,
    clinical: true,
    note: 'No sodium. Cells use up the dextrose, leaving plain water.',
  },
  saline_0_9: {
    id: 'saline_0_9',
    name: 'Normal saline (0.9% NaCl)',
    short: '0.9% saline',
    naMEqPerL: 154,
    clinical: true,
    note: 'Same concentration as healthy body fluids (isotonic).',
  },
  saline_3: {
    id: 'saline_3',
    name: 'Hypertonic saline (3% NaCl)',
    short: '3% saline',
    naMEqPerL: 513,
    clinical: true,
    note: 'More concentrated than healthy body fluids (hypertonic).',
  },
};

export type Status = 'healthy' | 'stable' | 'seizing' | 'critical';

export interface Infusion {
  fluid: FluidId;
  volumeL: number;
  durationMin: number;
  deliveredL: number;
}

export interface PhysState {
  timeMin: number;
  plasmaNa: number;
  tbwL: number;
  brainVolume: number;
  icp: number;
  status: Status;
  /** Net water flux into brain, relative volume per minute (negative = out of brain). */
  flux: number;
  naAtTreatmentStart: number;
  maxNaSinceStart: number;
  infusion: Infusion | null;
  totalInfusedL: number;
  hemolysis: boolean;
  overcorrected: boolean;
}

export const plasmaOsm = (na: number) => 2 * na + MODEL.otherOsmoles;

export function icpFromVolume(v: number): number {
  const swellingPct = (v - 1) * 100;
  return MODEL.icpBase + MODEL.icpScale * Math.exp(MODEL.icpSteepness * swellingPct);
}

/** Brain volume at which osmotic pull and tissue resistance balance for a given plasma Na. */
export function equilibriumBrainVolume(na: number): number {
  const p = plasmaOsm(na);
  let lo = 0.8;
  let hi = 1.4;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (MODEL.brainSolute / mid - p - MODEL.elasticity * (mid - 1) > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function nextStatus(prev: Status, icp: number, na: number): Status {
  if (icp > MODEL.criticalAboveICP) return 'critical';
  if (icp > MODEL.seizeAboveICP) return 'seizing';
  if (icp <= MODEL.stableAtOrBelowICP) return na >= 135 && icp <= 15 ? 'healthy' : 'stable';
  // Hysteresis band: keep seizing if already seizing.
  return prev === 'critical' ? 'seizing' : prev === 'healthy' ? 'stable' : prev;
}

export function brainFlux(na: number, v: number): number {
  const drive = MODEL.brainSolute / v - plasmaOsm(na) - MODEL.elasticity * (v - 1);
  return MODEL.permeability * drive;
}

/** A patient already at equilibrium with the given plasma sodium. */
export function createPatient(na: number = MODEL.initialNa): PhysState {
  const v = equilibriumBrainVolume(na);
  const icp = icpFromVolume(v);
  const tbwL = MODEL.bodyMassKg * MODEL.tbwFraction;
  return {
    timeMin: 0,
    plasmaNa: na,
    tbwL,
    brainVolume: v,
    icp,
    status: nextStatus('stable', icp, na),
    flux: 0,
    naAtTreatmentStart: na,
    maxNaSinceStart: na,
    infusion: null,
    totalInfusedL: 0,
    hemolysis: false,
    overcorrected: false,
  };
}

/** Predicted change in plasma Na from one litre of fluid (Adrogué–Madias style). */
export function naChangePerLitre(fluid: FluidId, na: number, tbwL: number): number {
  return (FLUIDS[fluid].naMEqPerL - na) / (tbwL + 1);
}

export function startInfusion(s: PhysState, fluid: FluidId, volumeL: number, durationMin = 60): PhysState {
  return { ...s, infusion: { fluid, volumeL, durationMin, deliveredL: 0 } };
}

const MAX_SUBSTEP_MIN = 0.5;

/**
 * Advance the model by dtMin minutes. If plasmaNaOverride is given, plasma Na is set
 * directly (used for the "how it happened" replay) and infusion is ignored.
 */
export function step(s: PhysState, dtMin: number, plasmaNaOverride?: number): PhysState {
  let st = { ...s, infusion: s.infusion ? { ...s.infusion } : null };
  let remaining = dtMin;
  while (remaining > 1e-9) {
    const dt = Math.min(MAX_SUBSTEP_MIN, remaining);
    remaining -= dt;

    if (plasmaNaOverride !== undefined) {
      st.plasmaNa = plasmaNaOverride;
    } else if (st.infusion) {
      const inf = st.infusion;
      const dV = Math.min(inf.volumeL - inf.deliveredL, (inf.volumeL * dt) / inf.durationMin);
      if (dV > 0) {
        const fluid = FLUIDS[inf.fluid];
        const totalNa = st.plasmaNa * st.tbwL + fluid.naMEqPerL * dV;
        st.tbwL += dV;
        st.plasmaNa = totalNa / st.tbwL;
        inf.deliveredL += dV;
        st.totalInfusedL += dV;
        if (inf.fluid === 'sterile_water') st.hemolysis = true;
      }
      if (inf.deliveredL >= inf.volumeL - 1e-9) st.infusion = null;
    }

    const flux = brainFlux(st.plasmaNa, st.brainVolume);
    st.brainVolume += flux * dt;
    st.flux = flux;
    st.icp = icpFromVolume(st.brainVolume);
    st.status = nextStatus(st.status, st.icp, st.plasmaNa);
    st.timeMin += dt;
    st.maxNaSinceStart = Math.max(st.maxNaSinceStart, st.plasmaNa);
    if (st.maxNaSinceStart - st.naAtTreatmentStart > MODEL.maxSafeRise24h) st.overcorrected = true;
  }
  return st;
}

export type OutcomeKind = 'worse' | 'no_help' | 'partial' | 'success' | 'overcorrected';

export interface Outcome {
  kind: OutcomeKind;
  naChange: number;
  icpChange: number;
}

export function classifyOutcome(before: PhysState, after: PhysState): Outcome {
  const naChange = after.plasmaNa - before.plasmaNa;
  const icpChange = after.icp - before.icp;
  let kind: OutcomeKind;
  if (after.overcorrected) kind = 'overcorrected';
  else if (after.status === 'stable' || after.status === 'healthy') kind = 'success';
  else if (icpChange > 0.5) kind = 'worse';
  else if (icpChange < -2) kind = 'partial';
  else kind = 'no_help';
  return { kind, naChange, icpChange };
}

// ---------------- Trials ----------------

/** IV rounds allowed per trial (each round = 1 h infusion + 5 h observation, so 4 rounds ≈ the first day). */
export const MAX_ROUNDS = 4;

export type Verdict = 'safe' | 'overcorrected' | 'harmed' | 'not_stabilized';

export interface TrialSummary {
  seizuresStopped: boolean;
  riseOk: boolean;
  noHarmfulFluid: boolean;
  /** Rise in plasma Na since the start of the trial (mEq/L). */
  rise: number;
  verdict: Verdict;
}

/** Score a finished trial: seizures stopped, first-day sodium rise within the safe limit, no harmful fluid. */
export function trialVerdict(s: PhysState): TrialSummary {
  const seizuresStopped = s.status === 'stable' || s.status === 'healthy';
  const rise = s.maxNaSinceStart - s.naAtTreatmentStart;
  const riseOk = !s.overcorrected;
  const noHarmfulFluid = !s.hemolysis;
  const verdict: Verdict = !riseOk ? 'overcorrected' : !noHarmfulFluid ? 'harmed' : seizuresStopped ? 'safe' : 'not_stabilized';
  return { seizuresStopped, riseOk, noHarmfulFluid, rise, verdict };
}
