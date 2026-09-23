// Canvas rendering for molecules and membranes. Everything expensive (shaded spheres, the
// lipid bilayer) is drawn once to offscreen canvases and then stamped with drawImage, which
// keeps frame times low on Chromebooks.
// Look inspired by Kodolab (kodolab.org): ball-and-stick water, charged ions with badges,
// phospholipid heads with oily tails. Code is original.

import { RADIUS, type Kind, type Particle, type World } from '../engine/membrane';

export const COLORS = {
  oxygen: '#e0452e',
  hydrogen: '#f4f4f4',
  na: '#7b61d9',
  cl: '#44b863',
  k: '#e8923a',
  head: '#ec8a6c',
  tail: '#e7cf7a',
  aquaporin: '#4aa6d8',
  aquaporinDark: '#2b6f9e',
  glowIn: '#12b5a5',
};

export function pixelRatio(): number {
  return Math.min(1.5, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  return c;
}

function sphere(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.15, x, y, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.25, color);
  g.addColorStop(1, shade(color, -0.35));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + (amt < 0 ? v * amt : (255 - v) * amt))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function badge(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, sign: '+' | '−') {
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.strokeStyle = '#333';
  ctx.lineWidth = Math.max(0.8, r * 0.18);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - r * 0.55, y);
  ctx.lineTo(x + r * 0.55, y);
  if (sign === '+') {
    ctx.moveTo(x, y - r * 0.55);
    ctx.lineTo(x, y + r * 0.55);
  }
  ctx.stroke();
}

const ROTATIONS = 12;
type SpriteSet = { img: HTMLCanvasElement[]; half: number };
const cache = new Map<string, SpriteSet>();

/** Pre-rendered sprites for a molecule kind at a given scale (world→px) and pixel ratio. */
export function sprites(kind: Kind, scale: number, dpr: number): SpriteSet {
  const key = `${kind}:${scale.toFixed(3)}:${dpr}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const R = RADIUS[kind] * scale * dpr;
  const size = R * 4.2;
  const half = size / 2;
  const n = kind === 'water' || kind === 'o2' ? ROTATIONS : 1;
  const img: HTMLCanvasElement[] = [];
  for (let i = 0; i < n; i++) {
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d') as CanvasRenderingContext2D;
    const a = (i / n) * Math.PI * 2;
    if (kind === 'water') {
      const hr = R * 0.55;
      const d = R * 0.95;
      for (const off of [-0.91, 0.91]) sphere(ctx, half + Math.cos(a + off) * d, half + Math.sin(a + off) * d, hr, COLORS.hydrogen);
      sphere(ctx, half, half, R, COLORS.oxygen);
    } else if (kind === 'o2') {
      const d = R * 0.6;
      sphere(ctx, half - Math.cos(a) * d, half - Math.sin(a) * d, R * 0.8, COLORS.oxygen);
      sphere(ctx, half + Math.cos(a) * d, half + Math.sin(a) * d, R * 0.8, COLORS.oxygen);
    } else {
      const color = kind === 'na' ? COLORS.na : kind === 'cl' ? COLORS.cl : COLORS.k;
      sphere(ctx, half, half, R, color);
      badge(ctx, half + R * 0.62, half + R * 0.62, R * 0.45, kind === 'cl' ? '−' : '+');
    }
    img.push(c);
  }
  const set = { img, half };
  cache.set(key, set);
  return set;
}

/** Draw every particle. `sx`,`sy` map world→px. Highlights recent crossers with a ring. */
export function drawParticles(ctx: CanvasRenderingContext2D, w: World, scale: number, dpr: number, ox = 0, oy = 0) {
  for (const p of w.particles) drawParticle(ctx, p, scale, dpr, ox, oy);
}

export function drawParticle(ctx: CanvasRenderingContext2D, p: Particle, scale: number, dpr: number, ox = 0, oy = 0) {
  const set = sprites(p.kind, scale, dpr);
  const idx = set.img.length > 1 ? Math.abs(Math.round((p.rot / (Math.PI * 2)) * ROTATIONS)) % ROTATIONS : 0;
  const x = (ox + p.x * scale) * dpr;
  const y = (oy + p.y * scale) * dpr;
  if (p.transit || p.glow > 0) {
    const a = p.transit ? 0.9 : Math.min(1, p.glow / 1.2);
    ctx.strokeStyle = `rgba(18,181,165,${a})`;
    ctx.lineWidth = 2.5 * dpr;
    ctx.beginPath();
    ctx.arc(x, y, (RADIUS[p.kind] * scale + 5) * dpr, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.drawImage(set.img[idx], x - set.half, y - set.half);
}

/**
 * Pre-render a vertical membrane (phospholipid bilayer with aquaporins or holes) spanning
 * y0..y1 in world units. Returns an offscreen canvas in device pixels, positioned at (lf, y0).
 */
export function renderMembrane(opts: {
  lf: number;
  rf: number;
  y0: number;
  y1: number;
  scale: number;
  dpr: number;
  channels: [number, number][];
  gaps: [number, number][];
  showChannels: boolean;
  showGaps: boolean;
}): { canvas: HTMLCanvasElement; x: number; y: number } {
  const { lf, rf, y0, y1, scale, dpr } = opts;
  const pad = 6;
  const T = (rf - lf) * scale * dpr;
  const Wd = T + pad * 2 * dpr;
  const Hd = (y1 - y0) * scale * dpr;
  const c = makeCanvas(Wd, Hd);
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  const hr = Math.max(2.2 * dpr, T * 0.15);
  const step = hr * 2.05;
  const toY = (wy: number) => (wy - y0) * scale * dpr;
  const inAny = (py: number, bands: [number, number][], grow = 0) =>
    bands.some(([a, b]) => py >= toY(a) - grow && py <= toY(b) + grow);
  const xL = pad * dpr + hr;
  const xR = pad * dpr + T - hr;
  const mid = pad * dpr + T / 2;
  // Tails first (oily core), then heads on top.
  ctx.strokeStyle = COLORS.tail;
  ctx.lineWidth = Math.max(1, dpr * 1.1);
  for (let y = hr; y < Hd; y += step) {
    const blocked = (opts.showChannels && inAny(y, opts.channels, hr)) || (opts.showGaps && inAny(y, opts.gaps, hr * 0.5));
    if (blocked) continue;
    for (const [x0, dir] of [[xL, 1], [xR, -1]] as const) {
      for (const dy of [-hr * 0.45, hr * 0.45]) {
        ctx.beginPath();
        ctx.moveTo(x0, y + dy);
        const len = mid - x0 - dir * hr * 0.3;
        const segs = 4;
        for (let i = 1; i <= segs; i++) {
          const xx = x0 + (len * i) / segs;
          ctx.lineTo(xx, y + dy + (i % 2 ? 1 : -1) * hr * 0.35);
        }
        ctx.stroke();
      }
    }
  }
  for (let y = hr; y < Hd; y += step) {
    const blocked = (opts.showChannels && inAny(y, opts.channels, hr)) || (opts.showGaps && inAny(y, opts.gaps, hr * 0.5));
    if (blocked) continue;
    sphere(ctx, xL, y, hr, COLORS.head);
    sphere(ctx, xR, y, hr, COLORS.head);
  }
  if (opts.showChannels) {
    for (const [a, b] of opts.channels) {
      const top = toY(a) - hr * 1.2;
      const h = toY(b) - toY(a) + hr * 2.4;
      const x = pad * dpr - 3 * dpr;
      const wdt = T + 6 * dpr;
      const g = ctx.createLinearGradient(x, 0, x + wdt, 0);
      g.addColorStop(0, COLORS.aquaporinDark);
      g.addColorStop(0.35, COLORS.aquaporin);
      g.addColorStop(1, COLORS.aquaporinDark);
      ctx.fillStyle = g;
      roundRect(ctx, x, top, wdt, h, 6 * dpr);
      ctx.fill();
      // The pore: a narrow water-filled lane through the protein.
      ctx.fillStyle = 'rgba(210,240,255,0.95)';
      roundRect(ctx, x + 2 * dpr, toY((a + b) / 2) - 2.2 * dpr, wdt - 4 * dpr, 4.4 * dpr, 2 * dpr);
      ctx.fill();
    }
  }
  return { canvas: c, x: lf - pad / scale, y: y0 };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Frame loop with visibility pausing and automatic 30 fps fallback when frames are slow. */
export function frameLoop(canvas: HTMLCanvasElement, tick: (dt: number) => void): () => void {
  let raf = 0;
  let last = performance.now();
  let visible = true;
  let slow = 0;
  let minInterval = 0;
  const io = typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver((e) => { visible = e[0]?.isIntersecting ?? true; })
    : null;
  io?.observe(canvas);
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    if (document.hidden || !visible) { last = now; return; }
    if (now - last < minInterval) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t0 = performance.now();
    tick(dt);
    const cost = performance.now() - t0;
    // If a frame's own work is heavy, drop to ~30 fps to leave room for the rest of the page.
    slow = cost > 9 ? Math.min(30, slow + 1) : Math.max(0, slow - 1);
    minInterval = slow > 10 ? 30 : 0;
  };
  raf = requestAnimationFrame(loop);
  return () => { cancelAnimationFrame(raf); io?.disconnect(); };
}

/** Small inline legend icon (data URL) for a molecule kind. */
export function legendIcon(kind: Kind): string {
  const set = sprites(kind, 2.2, 1);
  return set.img[set.img.length > 1 ? 2 : 0].toDataURL();
}
