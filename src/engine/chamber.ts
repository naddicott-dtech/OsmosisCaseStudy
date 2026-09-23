// Two-chamber membrane particle model for the mini-lab. Deterministic with a seed.
// Positions are in a unit box; the membrane is the vertical line x = 0.5.

export type ParticleKind = 'water' | 'sodium' | 'oxygen';
export type MembraneMode = 'bilayer' | 'aquaporin' | 'leaky';
export type Side = 'left' | 'right';

export interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface Chamber {
  particles: Particle[];
  mode: MembraneMode;
  rngState: number;
  /** Cumulative water crossings in each direction. */
  crossings: { toRight: number; toLeft: number };
}

export const MEMBRANE_X = 0.5;
export const AQUAPORIN_BANDS: [number, number][] = [
  [0.5, 0.57],
  [0.67, 0.74],
  [0.84, 0.91],
];
const BILAYER_WATER_P = 0.05;
const OSMOTIC_BIAS = 2.0;
/** Hydrostatic back-pressure: a taller column pushes water back. */
const HYDROSTATIC = 1.5;
const SPEED = 0.5;

export function rng(c: { rngState: number }): number {
  // mulberry32
  let t = (c.rngState = (c.rngState + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function sideOf(p: Particle): Side {
  return p.x < MEMBRANE_X ? 'left' : 'right';
}

export function count(c: Chamber, kind: ParticleKind, side: Side): number {
  let n = 0;
  for (const p of c.particles) if (p.kind === kind && sideOf(p) === side) n++;
  return n;
}

/** Water level of each side (0–1) — the side holding more water stands taller. */
export function waterLevel(c: Chamber, side: Side): number {
  const total = count(c, 'water', 'left') + count(c, 'water', 'right');
  if (total === 0) return 0.6;
  return Math.max(0.25, Math.min(0.95, 0.6 * (2 * count(c, 'water', side)) / total));
}

function randomParticle(c: Chamber, kind: ParticleKind, side: Side): Particle {
  const x = side === 'left' ? 0.03 + rng(c) * 0.44 : 0.53 + rng(c) * 0.44;
  const level = waterLevel(c, side);
  const y = 1 - level + 0.02 + rng(c) * (level - 0.04);
  const a = rng(c) * Math.PI * 2;
  return { kind, x, y, vx: Math.cos(a) * SPEED, vy: Math.sin(a) * SPEED };
}

export function createChamber(seed = 1, waterPerSide = 50, mode: MembraneMode = 'aquaporin'): Chamber {
  const c: Chamber = { particles: [], mode, rngState: seed, crossings: { toRight: 0, toLeft: 0 } };
  for (const side of ['left', 'right'] as Side[])
    for (let i = 0; i < waterPerSide; i++) c.particles.push(randomParticle(c, 'water', side));
  return c;
}

export function addParticles(c: Chamber, kind: ParticleKind, side: Side, n: number): Chamber {
  const next = { ...c, particles: [...c.particles] };
  for (let i = 0; i < n; i++) next.particles.push(randomParticle(next, kind, side));
  return next;
}

function inAquaporin(y: number): boolean {
  return AQUAPORIN_BANDS.some(([a, b]) => y >= a && y <= b);
}

/** Probability that a particle hitting the membrane passes through. */
export function crossProbability(c: Chamber, p: Particle, from: Side): number {
  if (p.kind === 'oxygen') return 0.9;
  if (p.kind === 'sodium') return c.mode === 'leaky' ? 0.9 : 0;
  // Water: base permeability depends on the membrane.
  let base: number;
  if (c.mode === 'leaky') base = 0.9;
  else if (c.mode === 'aquaporin') base = inAquaporin(p.y) ? 0.9 : BILAYER_WATER_P;
  else base = BILAYER_WATER_P;
  // Osmotic bias: water is more likely to move toward the side with a higher concentration of
  // solute that cannot cross; a taller water column pushes back (hydrostatic pressure).
  const to: Side = from === 'left' ? 'right' : 'left';
  const trapped = c.mode === 'leaky' ? 0 : 1;
  const conc = (side: Side) => (trapped * count(c, 'sodium', side)) / Math.max(1, count(c, 'water', side));
  const d = OSMOTIC_BIAS * (conc(to) - conc(from)) - HYDROSTATIC * (waterLevel(c, to) - waterLevel(c, from));
  return Math.max(0, Math.min(1, base * (1 + d)));
}

export function stepChamber(c: Chamber, dt: number): Chamber {
  const next: Chamber = { ...c, particles: c.particles.map((p) => ({ ...p })), crossings: { ...c.crossings } };
  const levels = { left: waterLevel(c, 'left'), right: waterLevel(c, 'right') };
  for (const p of next.particles) {
    // Small random kick = Brownian motion.
    const a = (rng(next) - 0.5) * 0.5;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    [p.vx, p.vy] = [p.vx * cos - p.vy * sin, p.vx * sin + p.vy * cos];
    const from = sideOf(p);
    let nx = p.x + p.vx * dt;
    let ny = p.y + p.vy * dt;
    const crossing = (from === 'left' && nx >= MEMBRANE_X) || (from === 'right' && nx < MEMBRANE_X);
    if (crossing) {
      if (rng(next) < crossProbability(c, p, from)) {
        if (p.kind === 'water') from === 'left' ? next.crossings.toRight++ : next.crossings.toLeft++;
      } else {
        p.vx = -p.vx;
        nx = p.x;
      }
    }
    const side: Side = nx < MEMBRANE_X ? 'left' : 'right';
    const top = 1 - levels[side] + 0.01;
    const minX = side === 'left' ? 0.01 : MEMBRANE_X + 0.005;
    const maxX = side === 'left' ? MEMBRANE_X - 0.005 : 0.99;
    if (nx < minX && !crossing) { nx = minX; p.vx = Math.abs(p.vx); }
    if (nx > maxX && !crossing) { nx = maxX; p.vx = -Math.abs(p.vx); }
    if (ny < top) { ny = top; p.vy = Math.abs(p.vy); }
    if (ny > 0.99) { ny = 0.99; p.vy = -Math.abs(p.vy); }
    p.x = nx;
    p.y = ny;
  }
  return next;
}
