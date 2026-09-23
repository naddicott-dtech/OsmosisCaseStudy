import { useEffect, useRef, useState } from 'preact/hooks';

// Particle view of the blood | barrier | brain cell boundary.
// The engine decides the NET water flux; particles cross aquaporins in both directions,
// with crossing odds tilted by that flux, so the animation never contradicts the model.

interface Props {
  plasmaNa: number;
  brainVolume: number;
  flux: number;
  reduceMotion: boolean;
  /** Increment to reset particles (e.g. on replay). */
  resetKey?: number;
}

interface P { x: number; y: number; vx: number; vy: number; kind: 'w' | 'na' | 'k' }

const W = 640;
const H = 340;
const BARRIER_L = 250;
const BARRIER_R = 282;
const SKULL_X = 600;
const BASE_CELL_W = 250;
/** Visual exaggeration of swelling so a ~6% change is visible. */
const AMP = 4.5;
const CHANNELS = [50, 125, 200, 275];
const CHANNEL_HALF = 9;
const FLUX_SCALE = 0.004;

export function cellEdge(v: number): number {
  return Math.min(SKULL_X - 2, BARRIER_R + BASE_CELL_W * (1 + (v - 1) * AMP));
}

function rnd(a: number, b: number) {
  return a + Math.random() * (b - a);
}

function makeParticle(kind: P['kind'], side: 'blood' | 'brain', edge: number): P {
  const x = side === 'blood' ? rnd(8, BARRIER_L - 8) : rnd(BARRIER_R + 8, edge - 8);
  const a = Math.random() * Math.PI * 2;
  const s = kind === 'w' ? 55 : 30;
  return { kind, x, y: rnd(8, H - 8), vx: Math.cos(a) * s, vy: Math.sin(a) * s };
}

export function BrainCanvas({ plasmaNa, brainVolume, flux, reduceMotion, resetKey = 0 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const props = useRef({ plasmaNa, brainVolume, flux });
  props.current = { plasmaNa, brainVolume, flux };
  const [counts, setCounts] = useState({ in: 0, out: 0 });

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const edge0 = cellEdge(props.current.brainVolume);
    const ps: P[] = [];
    for (let i = 0; i < 70; i++) ps.push(makeParticle('w', 'blood', edge0));
    for (let i = 0; i < 70; i++) ps.push(makeParticle('w', 'brain', edge0));
    for (let i = 0; i < 16; i++) ps.push(makeParticle('k', 'brain', edge0));
    const rbcs = [0, 1, 2, 3].map((i) => ({ x: 50 + (i % 2) * 110, y: i * 95 + 20 }));
    const events: { t: number; dir: 'in' | 'out' }[] = [];
    let colors: Record<string, string> = {};
    const readColors = () => {
      const cs = getComputedStyle(canvas);
      const g = (n: string) => cs.getPropertyValue(n).trim();
      colors = {
        blood: g('--blood-bg'), brain: g('--brain-bg'), barrier: g('--barrier'), channel: g('--channel'),
        water: g('--water'), na: g('--sodium'), k: g('--solute'), rbc: g('--rbc'), skull: g('--skull'),
        csf: g('--csf'), text: g('--ink'), arrow: g('--arrow'), cellEdge: g('--cell-edge'),
      };
    };
    readColors();

    const syncSodium = () => {
      const target = Math.round((16 * props.current.plasmaNa) / 140);
      const nas = ps.filter((p) => p.kind === 'na');
      if (nas.length < target) ps.push(makeParticle('na', 'blood', 0));
      else if (nas.length > target) ps.splice(ps.indexOf(nas[0]), 1);
    };
    for (let i = 0; i < 30; i++) syncSodium();

    const drawArrow = (edge: number) => {
      const b = Math.max(-1, Math.min(1, props.current.flux / FLUX_SCALE));
      if (Math.abs(b) < 0.05) return;
      const len = 30 + 60 * Math.abs(b);
      const cx = (BARRIER_L + BARRIER_R) / 2;
      const y = H - 26;
      const dir = Math.sign(b);
      const x0 = cx - (dir * len) / 2;
      const x1 = cx + (dir * len) / 2;
      ctx.strokeStyle = colors.arrow;
      ctx.fillStyle = colors.arrow;
      ctx.lineWidth = 4 + 5 * Math.abs(b);
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x1 - dir * 12, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x1 - dir * 16, y - 12);
      ctx.lineTo(x1 - dir * 16, y + 12);
      ctx.closePath();
      ctx.fill();
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('net water', cx, y - 16);
      void edge;
    };

    const draw = () => {
      const edge = cellEdge(props.current.brainVolume);
      ctx.fillStyle = colors.blood;
      ctx.fillRect(0, 0, BARRIER_L, H);
      ctx.fillStyle = colors.csf;
      ctx.fillRect(BARRIER_R, 0, SKULL_X - BARRIER_R, H);
      ctx.fillStyle = colors.brain;
      ctx.beginPath();
      ctx.moveTo(BARRIER_R, 0);
      ctx.lineTo(edge, 0);
      for (let y = 0; y <= H; y += 10) ctx.lineTo(edge + Math.sin(y / 18) * (edge >= SKULL_X - 3 ? 0 : 4), y);
      ctx.lineTo(BARRIER_R, H);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = colors.cellEdge;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = colors.skull;
      ctx.fillRect(SKULL_X, 0, W - SKULL_X, H);
      // Barrier with aquaporin channels.
      ctx.fillStyle = colors.barrier;
      ctx.fillRect(BARRIER_L, 0, BARRIER_R - BARRIER_L, H);
      ctx.fillStyle = colors.channel;
      for (const c of CHANNELS) ctx.fillRect(BARRIER_L, c - CHANNEL_HALF, BARRIER_R - BARRIER_L, CHANNEL_HALF * 2);
      // Red blood cells.
      ctx.fillStyle = colors.rbc;
      for (const r of rbcs) {
        ctx.beginPath();
        ctx.ellipse(r.x + 18, r.y, 22, 10, 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const p of ps) {
        ctx.fillStyle = p.kind === 'w' ? colors.water : p.kind === 'na' ? colors.na : colors.k;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.kind === 'w' ? 3.2 : 5.5, 0, Math.PI * 2);
        ctx.fill();
        if (p.kind !== 'w') {
          ctx.strokeStyle = colors.text;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
      ctx.fillStyle = colors.text;
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('BLOOD', 10, 18);
      ctx.fillText('BRAIN CELL', BARRIER_R + 10, 18);
      ctx.save();
      ctx.translate(SKULL_X + 24, H / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.fillText('SKULL', 0, 0);
      ctx.restore();
      drawArrow(edge);
    };

    const tick = (dt: number, now: number) => {
      syncSodium();
      const edge = cellEdge(props.current.brainVolume);
      const b = Math.max(-0.9, Math.min(0.9, props.current.flux / FLUX_SCALE));
      for (const r of rbcs) {
        r.y += 22 * dt;
        if (r.y > H + 20) r.y = -20;
      }
      for (const p of ps) {
        const turn = (Math.random() - 0.5) * 0.6;
        const c = Math.cos(turn);
        const s = Math.sin(turn);
        [p.vx, p.vy] = [p.vx * c - p.vy * s, p.vx * s + p.vy * c];
        let nx = p.x + p.vx * dt;
        let ny = p.y + p.vy * dt;
        const inBlood = p.x < BARRIER_L;
        const hitsBarrier = inBlood ? nx >= BARRIER_L - 3 : nx <= BARRIER_R + 4;
        if (hitsBarrier) {
          const inChannel = CHANNELS.some((ch) => Math.abs(ny - ch) < CHANNEL_HALF);
          const pCross = p.kind !== 'w' || !inChannel ? 0 : inBlood ? 0.5 * (1 + b) : 0.5 * (1 - b);
          if (Math.random() < pCross) {
            nx = inBlood ? BARRIER_R + 4 : BARRIER_L - 4;
            events.push({ t: now, dir: inBlood ? 'in' : 'out' });
          } else {
            p.vx = -p.vx;
            nx = p.x;
          }
        }
        const nowBlood = nx < BARRIER_L;
        const minX = nowBlood ? 4 : BARRIER_R + 4;
        const maxX = nowBlood ? BARRIER_L - 3 : edge - 4;
        if (nx < minX) { nx = minX; p.vx = Math.abs(p.vx); }
        if (nx > maxX) { nx = maxX; p.vx = -Math.abs(p.vx); }
        if (ny < 4) { ny = 4; p.vy = Math.abs(p.vy); }
        if (ny > H - 4) { ny = H - 4; p.vy = -Math.abs(p.vy); }
        p.x = nx;
        p.y = ny;
      }
      while (events.length && now - events[0].t > 10000) events.shift();
    };

    if (reduceMotion) {
      const redraw = () => {
        for (let i = 0; i < 30; i++) syncSodium();
        const edge = cellEdge(props.current.brainVolume);
        for (const p of ps) if (p.x > BARRIER_R && p.x > edge - 4) p.x = rnd(BARRIER_R + 8, edge - 8);
        draw();
      };
      canvas.addEventListener('redraw', redraw);
      redraw();
      return () => canvas.removeEventListener('redraw', redraw);
    }
    let raf = 0;
    let last = performance.now();
    let lastCount = 0;
    let frame = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden) {
        last = now;
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      tick(dt, now);
      draw();
      if (++frame % 120 === 0) readColors();
      if (now - lastCount > 400) {
        lastCount = now;
        let i = 0;
        let o = 0;
        for (const e of events) e.dir === 'in' ? i++ : o++;
        setCounts({ in: i, out: o });
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reduceMotion, resetKey]);

  // In reduced-motion mode, redraw the static frame whenever the model changes.
  useEffect(() => {
    if (!reduceMotion) return;
    const canvas = ref.current;
    if (canvas) canvas.dispatchEvent(new Event('redraw'));
  }, [plasmaNa, brainVolume, flux, reduceMotion]);

  const netWord = Math.abs(flux) < FLUX_SCALE * 0.05 ? 'about equal both ways (no net movement)' : flux > 0 ? 'more water moving INTO the brain' : 'more water moving OUT of the brain';
  return (
    <figure class="micro">
      <canvas ref={ref} style={{ aspectRatio: `${W} / ${H}` }} role="img"
        aria-label={`Microscopic view. Blood sodium ${plasmaNa.toFixed(0)}. Brain cell swelling ${((brainVolume - 1) * 100).toFixed(1)} percent. Currently ${netWord}.`} />
      <figcaption>
        <ul class="legend">
          <li><span class="dot dot-water" /> water (H₂O)</li>
          <li><span class="dot dot-na" /> sodium ion (Na⁺)</li>
          <li><span class="dot dot-k" /> solutes trapped in brain cell</li>
          <li><span class="swatch swatch-channel" /> aquaporin (water channel)</li>
        </ul>
        {!reduceMotion && (
          <p class="counts" aria-live="off">
            Water crossings in the last 10 s: <strong>{counts.in}</strong> into brain · <strong>{counts.out}</strong> into blood
          </p>
        )}
        <p class="netflow" aria-live="polite">Right now: {netWord}.</p>
        <p class="fineprint">Cell swelling is exaggerated ×{AMP} so you can see it. Particle numbers are illustrative.</p>
      </figcaption>
    </figure>
  );
}
