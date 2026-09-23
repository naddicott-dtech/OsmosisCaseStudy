// Particle world with a vertical membrane, used by the membrane mini-lab and the brain view.
//
// Water crosses two ways: FAST through aquaporin channels and SLOWLY straight through the lipid
// bilayer. Ions never cross a bilayer; they cross only through the holes of a "leaky" membrane.
// O2 dissolves through the bilayer.
//
// Two layers, deliberately:
//  • MACRO: the water levels follow the AVERAGE behaviour of a real solution (trillions of
//    molecules, so no visible jitter). Net water flow is driven by how crowded water is at each
//    face of the membrane (dissolved salt takes up room, so salty water has fewer water molecules
//    per unit volume) and is opposed by the extra pressure of a taller column. Nothing tells the
//    water which way to go; the direction falls out of those two rules.
//  • SAMPLE: a few hundred dots walk at random and cross BOTH ways. Their crossing odds are
//    nudged only enough that the sample stays in step with the macro counts.
// Visual idea (a headcount of water on each side, water squeezing through the lipid) credited to
// Kodolab (kodolab.org). Code is original.

export type Kind = 'water' | 'na' | 'cl' | 'o2' | 'k';
export type Mode = 'bilayer' | 'aquaporin' | 'leaky';
export type Route = 'bilayer' | 'channel' | 'gap';
export type Side = 0 | 1; // 0 = left, 1 = right

export interface Transit {
  route: Route;
  t: number;
  dur: number;
  from: Side;
}

export interface Particle {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  side: Side;
  transit: Transit | null;
  /** Seconds of highlight left after a crossing (rendering only). */
  glow: number;
  rot: number;
}

export interface CrossEvent {
  t: number;
  route: Route;
  /** Side the molecule ENDED on. */
  to: Side;
}

export interface WorldOptions {
  width: number;
  height: number;
  membraneX: number;
  thickness: number;
  mode: Mode;
  /** Water levels driven by the macro model (mini-lab). */
  levels: boolean;
  /** Molecules a full-height compartment holds (levels mode). */
  capacity: number;
  /** Aquaporin bands as [y0, y1] in world units. */
  channels: [number, number][];
  /** Holes in a leaky membrane as [y0, y1]. */
  gaps: [number, number][];
  seed: number;
}

export interface Macro {
  /** Water molecules per side (continuous). */
  water: [number, number];
  /** Dissolved ions per side (continuous). */
  ions: [number, number];
}

export interface World {
  o: WorldOptions;
  particles: Particle[];
  time: number;
  rng: number;
  macro: Macro;
  /** Right boundary of the right compartment (brain cell edge in the brain view). */
  rightEdge: number;
  crossings: Record<Route, [number, number]>; // [toLeft, toRight]
  events: CrossEvent[];
  /** Per-side counts of free (not in transit) particles, kept incrementally. */
  counts: Record<Kind, [number, number]>;
}

export const SPEED: Record<Kind, number> = { water: 115, na: 55, cl: 55, o2: 80, k: 50 };
export const RADIUS: Record<Kind, number> = { water: 4.2, na: 5.5, cl: 6.5, o2: 5, k: 6 };
const DUR: Record<Route, number> = { channel: 0.45, bilayer: 1.8, gap: 0.35 };
/** Chance that a molecule hitting the membrane gets in, by route (sample layer). */
export const P_ENTER = { channelWater: 0.85, bilayerWater: 0.04, bilayerO2: 0.6, gap: 0.85 };
/**
 * Macro model. Water flux from side A = rate[mode] · capacity · (wetted height) · (water fraction at A)
 * · (1 + hydrostatic · (level_A − level_B)). Ions through holes: ionRate · capacity · height · (ion fraction).
 */
export const MACRO = {
  rate: { bilayer: 0.005, aquaporin: 0.028, leaky: 0.035 } as Record<Mode, number>,
  ionRate: 0.02,
  hydrostatic: 0.8,
};
/** How strongly the sample is steered toward the macro counts (per molecule of mismatch). */
const STEER = 0.35;

export function rand(w: { rng: number }): number {
  let t = (w.rng = (w.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const zero = (): [number, number] => [0, 0];

export function createWorld(o: WorldOptions): World {
  return {
    o,
    particles: [],
    time: 0,
    rng: o.seed | 0,
    macro: { water: [0, 0], ions: [0, 0] },
    rightEdge: o.width,
    crossings: { bilayer: zero(), channel: zero(), gap: zero() },
    events: [],
    counts: { water: zero(), na: zero(), cl: zero(), o2: zero(), k: zero() },
  };
}

export const leftFace = (w: World) => w.o.membraneX - w.o.thickness / 2;
export const rightFace = (w: World) => w.o.membraneX + w.o.thickness / 2;

/** Liquid level per side (0–1 of height) from the macro model. */
export function level(w: World, side: Side): number {
  if (!w.o.levels) return 1;
  const n = w.macro.water[side] + w.macro.ions[side];
  return Math.max(0.1, Math.min(0.97, n / w.o.capacity));
}

/** Top of the liquid on a side, in world units. */
export function top(w: World, side: Side): number {
  return w.o.height * (1 - level(w, side));
}

function bounds(w: World, side: Side, r: number) {
  const x0 = side === 0 ? r : rightFace(w) + r;
  const x1 = side === 0 ? leftFace(w) - r : w.rightEdge - r;
  return { x0, x1, y0: top(w, side) + r, y1: w.o.height - r };
}

export function spawn(w: World, kind: Kind, side: Side, at?: { x?: number; y?: number }): Particle {
  const r = RADIUS[kind];
  const b = bounds(w, side, r);
  const a = rand(w) * Math.PI * 2;
  const p: Particle = {
    kind,
    side,
    x: at?.x ?? b.x0 + rand(w) * Math.max(1, b.x1 - b.x0),
    y: at?.y ?? b.y0 + rand(w) * Math.max(1, b.y1 - b.y0),
    vx: Math.cos(a) * SPEED[kind],
    vy: Math.sin(a) * SPEED[kind],
    transit: null,
    glow: 0,
    rot: rand(w) * Math.PI * 2,
  };
  w.particles.push(p);
  w.counts[kind][side]++;
  return p;
}

/** Remove one free particle of a kind from a side (brain view: blood carries it away). */
export function removeOne(w: World, kind: Kind, side: Side, pick: (p: Particle) => boolean = () => true): boolean {
  const i = w.particles.findIndex((p) => p.kind === kind && p.side === side && !p.transit && pick(p));
  if (i < 0) return false;
  w.particles.splice(i, 1);
  w.counts[kind][side]--;
  return true;
}

export function count(w: World, kind: Kind | 'ions' | 'all', side: Side): number {
  const c = w.counts;
  if (kind === 'ions') return c.na[side] + c.cl[side];
  if (kind === 'all') return c.water[side] + c.na[side] + c.cl[side] + c.o2[side] + c.k[side];
  return c[kind][side];
}

function inBand(y: number, bands: [number, number][]) {
  return bands.some(([a, b]) => y >= a && y <= b);
}

/** Which route (if any) this particle may use where it hit the membrane, and the odds of getting in. */
export function entry(w: World, p: Particle): { route: Route; p: number } | null {
  const mode = w.o.mode;
  if (mode === 'leaky' && inBand(p.y, w.o.gaps) && p.kind !== 'k') return { route: 'gap', p: P_ENTER.gap };
  if (p.kind === 'water') {
    if (mode !== 'bilayer' && inBand(p.y, w.o.channels)) return { route: 'channel', p: P_ENTER.channelWater };
    return { route: 'bilayer', p: P_ENTER.bilayerWater };
  }
  if (p.kind === 'o2') return { route: 'bilayer', p: P_ENTER.bilayerO2 };
  return null; // ions and trapped solutes bounce off the lipid
}

/** Net macro water flux toward the RIGHT (molecules per second) for the current state. */
export function macroWaterFlux(w: World): number {
  const m = w.macro;
  const h = [level(w, 0), level(w, 1)];
  const wetted = Math.min(h[0], h[1]);
  const frac = (s: Side) => m.water[s] / Math.max(1e-6, m.water[s] + m.ions[s]);
  const push = (s: Side) => Math.max(0, 1 + MACRO.hydrostatic * (h[s] - h[s === 0 ? 1 : 0]));
  const k = MACRO.rate[w.o.mode] * w.o.capacity * wetted;
  return k * (frac(0) * push(0) - frac(1) * push(1));
}

function stepMacro(w: World, dt: number) {
  const m = w.macro;
  // Small sub-steps keep the stiff pressure term stable.
  const n = Math.max(1, Math.ceil(dt / 0.02));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    const jw = macroWaterFlux(w) * h;
    m.water[0] -= jw;
    m.water[1] += jw;
    if (w.o.mode === 'leaky') {
      const tot = (s: Side) => m.water[s] + m.ions[s];
      const cf = (s: Side) => m.ions[s] / Math.max(1e-6, tot(s));
      const ji = MACRO.ionRate * w.o.capacity * Math.min(level(w, 0), level(w, 1)) * (cf(0) - cf(1)) * h;
      m.ions[0] -= ji;
      m.ions[1] += ji;
    }
  }
}

export interface StepOptions {
  /** Brain view: multiplier on crossing odds for water leaving `from`, set from the physiology engine. */
  bias?: (from: Side) => number;
  /** Blood flows: drift the left compartment downward and wrap (brain view). */
  flowLeft?: number;
}

/** Steering factor that keeps the sample's counts in step with the macro model (levels mode). */
function steer(w: World, kind: Kind, from: Side): number {
  const to: Side = from === 0 ? 1 : 0;
  let deficitTo: number;
  if (kind === 'water') deficitTo = (w.macro.water[to] - count(w, 'water', to)) - (w.macro.water[from] - count(w, 'water', from));
  else if (kind === 'na' || kind === 'cl') deficitTo = (w.macro.ions[to] - count(w, 'ions', to)) - (w.macro.ions[from] - count(w, 'ions', from));
  else return 1;
  return Math.max(0.05, Math.min(4, 1 + STEER * deficitTo));
}

export function step(w: World, dt: number, so: StepOptions = {}) {
  w.time += dt;
  if (w.o.levels) stepMacro(w, dt);
  const H = w.o.height;
  const lf = leftFace(w);
  const rf = rightFace(w);
  const tops: [number, number] = [top(w, 0), top(w, 1)];
  const wettedTop = Math.max(tops[0], tops[1]);

  for (const p of w.particles) {
    if (p.glow > 0) p.glow = Math.max(0, p.glow - dt);
    const r = RADIUS[p.kind];

    if (p.transit) {
      const tr = p.transit;
      tr.t += dt;
      const f = Math.min(1, tr.t / tr.dur);
      p.x = tr.from === 0 ? lf + (rf - lf) * f : rf - (rf - lf) * f;
      if (f >= 1) {
        const to: Side = tr.from === 0 ? 1 : 0;
        p.side = to;
        p.transit = null;
        w.counts[p.kind][to]++;
        p.x = to === 1 ? rf + r + 0.5 : lf - r - 0.5;
        p.vx = (to === 1 ? 1 : -1) * Math.max(20, Math.abs(p.vx));
        p.y = Math.max(tops[to] + r, Math.min(H - r, p.y));
        p.glow = 2;
        w.crossings[tr.route][to]++;
        w.events.push({ t: w.time, route: tr.route, to });
      }
      continue;
    }

    // Brownian motion: small random turns at constant speed.
    const turn = (rand(w) - 0.5) * 0.7;
    const c = Math.cos(turn);
    const s = Math.sin(turn);
    const vx = p.vx * c - p.vy * s;
    p.vy = p.vx * s + p.vy * c;
    p.vx = vx;
    p.rot += turn * 0.5;

    let nx = p.x + p.vx * dt;
    let ny = p.y + p.vy * dt + (p.side === 0 && so.flowLeft ? so.flowLeft * dt : 0);
    const b = bounds(w, p.side, r);

    const hitting = p.side === 0 ? nx > b.x1 : nx < b.x0;
    if (hitting) {
      const e = entry(w, p);
      // In levels mode a molecule can only cross where there is liquid on BOTH sides.
      const wetted = !w.o.levels || ny >= wettedTop + r;
      let odds = e && wetted ? e.p : 0;
      if (odds > 0) {
        if (w.o.levels) odds *= steer(w, p.kind, p.side);
        if (so.bias && p.kind === 'water') odds *= so.bias(p.side);
      }
      if (e && rand(w) < Math.min(1, odds)) {
        p.transit = { route: e.route, t: 0, dur: DUR[e.route] * (0.8 + rand(w) * 0.4), from: p.side };
        w.counts[p.kind][p.side]--;
        p.x = p.side === 0 ? lf : rf;
        continue;
      }
      p.vx = -p.vx;
      nx = p.x;
    }
    if (nx < b.x0) { nx = b.x0; p.vx = Math.abs(p.vx); }
    if (nx > b.x1) { nx = b.x1; p.vx = -Math.abs(p.vx); }
    if (so.flowLeft && p.side === 0) {
      if (ny > H + r) ny = -r; // blood keeps flowing
      if (ny < -r) ny = H + r;
    } else {
      if (ny < b.y0) { ny = b.y0; p.vy = Math.abs(p.vy); }
      if (ny > b.y1) { ny = b.y1; p.vy = -Math.abs(p.vy); }
    }
    p.x = nx;
    p.y = ny;
  }
  while (w.events.length && w.time - w.events[0].t > 30) w.events.shift();
}

export function recent(w: World, seconds: number) {
  const out = { toLeft: 0, toRight: 0, bilayer: 0, channel: 0, gap: 0 };
  for (const e of w.events) {
    if (w.time - e.t > seconds) continue;
    if (e.to === 0) out.toLeft++;
    else out.toRight++;
    out[e.route]++;
  }
  return out;
}

// ---------------- Mini-lab presets ----------------

export type Preset = 'salt_left' | 'salt_right' | 'equal_salt' | 'pure' | 'very_salty_left';

/** Ions per side in a starting compartment of CHAMBER.startFill × capacity molecules. */
export const PRESETS: Record<Preset, { label: string; ions: [number, number] }> = {
  salt_left: { label: 'Salt water | Pure water', ions: [44, 0] },
  salt_right: { label: 'Pure water | Salt water', ions: [0, 44] },
  equal_salt: { label: 'Salt water | Salt water (same)', ions: [30, 30] },
  very_salty_left: { label: 'Very salty | Slightly salty', ions: [60, 16] },
  pure: { label: 'Pure water | Pure water', ions: [0, 0] },
};

export const CHAMBER = {
  width: 600,
  height: 320,
  membraneX: 300,
  thickness: 34,
  capacity: 290,
  startFill: 0.6,
};

/**
 * Mini-lab chamber. Both sides start at the SAME volume (same level); salt takes up room,
 * so the salty side starts with fewer water molecules.
 */
export function createChamber(mode: Mode, preset: Preset, seed = 1): World {
  const C = CHAMBER;
  const H = C.height;
  const w = createWorld({
    width: C.width,
    height: H,
    membraneX: C.membraneX,
    thickness: C.thickness,
    mode,
    levels: true,
    capacity: C.capacity,
    channels: [[H * 0.6, H * 0.66], [H * 0.73, H * 0.79], [H * 0.86, H * 0.92]],
    gaps: [[H * 0.56, H * 0.63], [H * 0.7, H * 0.77], [H * 0.84, H * 0.91]],
    seed,
  });
  const perSide = Math.round(C.capacity * C.startFill);
  const ions = PRESETS[preset].ions;
  for (const side of [0, 1] as Side[]) {
    const n = ions[side] - (ions[side] % 2);
    w.macro.ions[side] = n;
    w.macro.water[side] = perSide - n;
    for (let i = 0; i < n / 2; i++) {
      spawn(w, 'na', side);
      spawn(w, 'cl', side);
    }
    for (let i = 0; i < perSide - n; i++) spawn(w, 'water', side);
  }
  return w;
}

export function setMode(w: World, mode: Mode) {
  w.o = { ...w.o, mode };
}

export function addOxygen(w: World, side: Side, n = 10) {
  for (let i = 0; i < n; i++) spawn(w, 'o2', side);
}
