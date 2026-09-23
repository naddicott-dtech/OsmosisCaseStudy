import { useEffect, useRef, useState } from 'preact/hooks';
import {
  count, createWorld, leftFace, removeOne, rightFace, spawn, step, rand,
  type Side, type World,
} from '../engine/membrane';
import { COLORS, drawParticles, frameLoop, legendIcon, pixelRatio, renderMembrane } from './molrender';

// Blood | blood–brain barrier (lipid bilayer + aquaporins) | brain cell | skull.
// Molecules walk at random and cross BOTH ways, through aquaporins AND straight through the lipid.
// The physiology engine sets the NET water flux (so the picture always matches the gauges); here it
// tilts crossing odds. Blood keeps flowing, carrying Na⁺/Cl⁻ in proportion to the current blood sodium.

interface Props {
  plasmaNa: number;
  brainVolume: number;
  flux: number;
  reduceMotion: boolean;
  /** Increment to reset particles and tallies (e.g. on replay). */
  resetKey?: number;
  compact?: boolean;
}

const W = 640;
const H = 340;
const MX = 266;
const T = 34;
const SKULL_X = 604;
const BASE_CELL_W = 250;
/** Visual exaggeration of swelling so a ~6% change is visible. */
const AMP = 4.5;
const FLUX_SCALE = 0.004;
const BLOOD_WATER = 80;
const BRAIN_WATER = 80;
const BRAIN_SOLUTE = 14;
const CHANNELS: [number, number][] = [[38, 58], [108, 128], [178, 198], [248, 268]];

export function cellEdge(v: number): number {
  return Math.min(SKULL_X - 3, MX + T / 2 + BASE_CELL_W * (1 + (v - 1) * AMP));
}

function makeWorld(v: number): World {
  const w = createWorld({
    width: W, height: H, membraneX: MX, thickness: T, mode: 'aquaporin', levels: false,
    capacity: 0, channels: CHANNELS, gaps: [], seed: (Date.now() % 100000) | 0,
  });
  w.rightEdge = cellEdge(v);
  for (let i = 0; i < BLOOD_WATER; i++) spawn(w, 'water', 0);
  for (let i = 0; i < BRAIN_WATER; i++) spawn(w, 'water', 1);
  for (let i = 0; i < BRAIN_SOLUTE; i++) spawn(w, 'k', 1);
  return w;
}

/** Keep the blood's make-up matched to the current plasma: fresh blood arrives at the top. */
function syncBlood(w: World, na: number) {
  const pairs = Math.round((12 * na) / 140);
  const topSpawn = () => ({ x: 10 + rand(w) * (leftFace(w) - 20), y: 4 });
  if (count(w, 'na', 0) < pairs) { spawn(w, 'na', 0, topSpawn()); spawn(w, 'cl', 0, topSpawn()); }
  else if (count(w, 'na', 0) > pairs) { removeOne(w, 'na', 0, (p) => p.y > H - 40); removeOne(w, 'cl', 0, (p) => p.y > H - 40); }
  const water = count(w, 'water', 0);
  if (water < BLOOD_WATER) spawn(w, 'water', 0, topSpawn());
  else if (water > BLOOD_WATER + 2) removeOne(w, 'water', 0, (p) => p.y > H - 40);
}

export function BrainCanvas({ plasmaNa, brainVolume, flux, reduceMotion, resetKey = 0, compact = false }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const props = useRef({ plasmaNa, brainVolume, flux });
  props.current = { plasmaNa, brainVolume, flux };
  const world = useRef<World | null>(null);
  const [tally, setTally] = useState({ inBrain: 0, inBlood: 0, channel: 0, bilayer: 0 });

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = pixelRatio();
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const w = makeWorld(props.current.brainVolume);
    world.current = w;
    for (let i = 0; i < 40; i++) syncBlood(w, props.current.plasmaNa);
    const membrane = renderMembrane({
      lf: leftFace(w), rf: rightFace(w), y0: 0, y1: H, scale: 1, dpr,
      channels: CHANNELS, gaps: [], showChannels: true, showGaps: false,
    });
    const rbcs = [0, 1, 2, 3].map((i) => ({ x: 40 + (i % 2) * 120, y: i * 95 + 20 }));
    let colors: Record<string, string> = {};
    const readColors = () => {
      const cs = getComputedStyle(canvas);
      const g = (n: string) => cs.getPropertyValue(n).trim();
      colors = { blood: g('--blood-bg'), brain: g('--brain-bg'), csf: g('--csf'), skull: g('--skull'), ink: g('--ink'), rbc: g('--rbc'), edge: g('--cell-edge') };
    };
    readColors();

    const draw = () => {
      const edge = cellEdge(props.current.brainVolume);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = colors.blood;
      ctx.fillRect(0, 0, MX, H);
      ctx.fillStyle = colors.csf;
      ctx.fillRect(MX, 0, SKULL_X - MX, H);
      ctx.fillStyle = colors.brain;
      ctx.beginPath();
      ctx.moveTo(MX, 0);
      ctx.lineTo(edge, 0);
      const pressed = edge >= SKULL_X - 4;
      for (let y = 0; y <= H; y += 10) ctx.lineTo(edge + (pressed ? 0 : Math.sin(y / 18) * 4), y);
      ctx.lineTo(MX, H);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = colors.edge;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let y = 0; y <= H; y += 10) {
        const x = edge + (pressed ? 0 : Math.sin(y / 18) * 4);
        if (y === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = colors.skull;
      ctx.fillRect(SKULL_X, 0, W - SKULL_X, H);
      ctx.fillStyle = colors.rbc;
      for (const r of rbcs) {
        ctx.beginPath();
        ctx.ellipse(r.x + 18, r.y, 24, 10, 0.25, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(membrane.canvas, membrane.x * dpr, membrane.y * dpr);
      drawParticles(ctx, w, 1, dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = colors.ink;
      ctx.font = '700 12px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('BLOOD (flowing)', 8, 16);
      ctx.fillText('BRAIN CELL', MX + T / 2 + 8, 16);
      ctx.save();
      ctx.translate(SKULL_X + 20, H / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.fillText('SKULL', 0, 0);
      ctx.restore();
      // Net-flow arrow from the engine.
      const b = Math.max(-1, Math.min(1, props.current.flux / FLUX_SCALE));
      if (Math.abs(b) > 0.05) {
        const dir = Math.sign(b);
        const len = 26 + 50 * Math.abs(b);
        const y = H - 22;
        ctx.strokeStyle = COLORS.glowIn;
        ctx.fillStyle = COLORS.glowIn;
        ctx.lineWidth = 4 + 5 * Math.abs(b);
        ctx.beginPath();
        ctx.moveTo(MX - (dir * len) / 2, y);
        ctx.lineTo(MX + dir * (len / 2 - 12), y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(MX + (dir * len) / 2, y);
        ctx.lineTo(MX + dir * (len / 2 - 16), y - 11);
        ctx.lineTo(MX + dir * (len / 2 - 16), y + 11);
        ctx.fill();
        ctx.font = '800 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('NET WATER', MX, y - 16);
      }
    };

    const update = () => {
      const c = w.crossings;
      setTally({ inBrain: c.channel[1] + c.bilayer[1], inBlood: c.channel[0] + c.bilayer[0], channel: c.channel[0] + c.channel[1], bilayer: c.bilayer[0] + c.bilayer[1] });
    };
    update();

    if (reduceMotion) {
      const redraw = () => {
        w.rightEdge = cellEdge(props.current.brainVolume);
        for (let i = 0; i < 20; i++) syncBlood(w, props.current.plasmaNa);
        for (const p of w.particles) if (p.side === 1 && p.x > w.rightEdge - 6) p.x = rightFace(w) + 8 + rand(w) * (w.rightEdge - rightFace(w) - 16);
        draw();
      };
      canvas.addEventListener('redraw', redraw);
      redraw();
      return () => canvas.removeEventListener('redraw', redraw);
    }

    let n = 0;
    const stop = frameLoop(canvas, (dt) => {
      const { plasmaNa: na, brainVolume: v, flux: f } = props.current;
      w.rightEdge = cellEdge(v);
      syncBlood(w, na);
      const b = Math.max(-0.9, Math.min(0.9, f / FLUX_SCALE));
      step(w, dt, { bias: (from: Side) => (from === 0 ? 1 + b : Math.max(0.05, 1 - b)), flowLeft: 22 });
      for (const r of rbcs) {
        r.y += 22 * dt;
        if (r.y > H + 20) r.y = -20;
      }
      draw();
      if (++n % 15 === 0) update();
      if (n % 120 === 0) readColors();
    });
    return stop;
  }, [reduceMotion, resetKey]);

  useEffect(() => {
    if (reduceMotion) ref.current?.dispatchEvent(new Event('redraw'));
  }, [plasmaNa, brainVolume, flux, reduceMotion]);

  const netWord = Math.abs(flux) < FLUX_SCALE * 0.05 ? 'about equal both ways (no net movement)' : flux > 0 ? 'more water moving INTO the brain' : 'more water moving OUT of the brain';
  const net = tally.inBrain - tally.inBlood;
  return (
    <figure class="micro">
      <canvas ref={ref} style={{ aspectRatio: `${W} / ${H}` }} role="img"
        aria-label={`Microscopic view. Blood sodium ${plasmaNa.toFixed(0)}. Brain cell swelling ${((brainVolume - 1) * 100).toFixed(1)} percent. Currently ${netWord}.`} />
      <figcaption>
        {!reduceMotion && (
          <div class="tally-row" aria-live="off">
            <div class="tally"><strong>{tally.inBrain}</strong><small>water → into brain</small></div>
            <div class="tally"><strong>{tally.inBlood}</strong><small>water → into blood</small></div>
            <div class="tally net"><strong>{net > 0 ? `+${net}` : net}</strong><small>net into brain</small></div>
          </div>
        )}
        <p class="netflow" aria-live="polite">Right now: {netWord}.</p>
        {!compact && (
          <>
            {!reduceMotion && (
              <p class="small">
                Crossings so far: <strong>{tally.channel}</strong> through aquaporins, <strong>{tally.bilayer}</strong> squeezing
                straight through the lipid bilayer (look for the glowing rings).
              </p>
            )}
            <ul class="legend">
              <li><img src={legendIcon('water')} alt="" /> water</li>
              <li><img src={legendIcon('na')} alt="" /> Na⁺</li>
              <li><img src={legendIcon('cl')} alt="" /> Cl⁻</li>
              <li><img src={legendIcon('k')} alt="" /> K⁺ and other solutes trapped in the cell</li>
              <li><span class="ring" /> just crossed</li>
            </ul>
            <p class="fineprint">
              Cell swelling is exaggerated ×{AMP} so you can see it. Molecule numbers are a small sample; the net direction
              follows the model's calculation.
            </p>
          </>
        )}
      </figcaption>
    </figure>
  );
}
