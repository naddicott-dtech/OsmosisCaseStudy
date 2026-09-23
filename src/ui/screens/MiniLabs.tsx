import { useEffect, useRef, useState } from 'preact/hooks';
import { MINILAB_PROMPTS } from '../../content/case';
import {
  addOxygen, createChamber, step, count, level, top, leftFace, rightFace, recent, setMode, PRESETS, CHAMBER,
  type World, type Mode, type Preset, type Side,
} from '../../engine/membrane';
import { COLORS, drawParticles, frameLoop, legendIcon, pixelRatio, renderMembrane } from '../molrender';
import {
  nacl_mOsm, tonicity, animalCellVolume, animalCellState, plantCellVolume, plantCellState, solutePotential,
  CELL_INSIDE_mOsm, RBC_LYSIS_RELATIVE_VOLUME,
} from '../../engine/cells';
import { saved, update, goTo } from '../../state';
import { Prompt, answered } from '../widgets';

type Tab = 'membrane' | 'cell' | 'psi';

export function MiniLabs() {
  const [tab, setTab] = useState<Tab>('membrane');
  const tabs: [Tab, string][] = [
    ['membrane', '1 · Membrane chamber'],
    ['cell', '2 · Cell in a beaker'],
    ['psi', '3 · Water potential (Honors)'],
  ];
  const honors = saved.value.honors;
  const coreDone = answered(MINILAB_PROMPTS.membrane.id) && answered(MINILAB_PROMPTS.cell.id) && (!honors || answered(MINILAB_PROMPTS.psi.id));
  return (
    <div class="stack">
      <div class="tabs" role="tablist" aria-label="Mini-labs">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`panel-${id}`}
            class={tab === id ? 'tab on' : 'tab'} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'membrane' && <MembraneLab />}
        {tab === 'cell' && <CellLab />}
        {tab === 'psi' && <PsiLab />}
      </div>
      <section class="panel row">
        <p class="muted">
          Mini-labs 1 and 2 are required for everyone. Lab 3 (water potential) is <strong>required for Honors</strong> and optional for everyone else.
        </p>
        <label class="checkbox">
          <input type="checkbox" checked={honors} onChange={(e) => update(() => ({ honors: (e.target as HTMLInputElement).checked }))} />
          I'm in Honors Biology
        </label>
        <button class="primary" disabled={!coreDone} onClick={() => goTo(4)}>Build the causal chain →</button>
        {!coreDone && (
          <p class="gate-hint" aria-live="polite">
            Still needed:{' '}
            {([
              ['membrane', 'Lab 1 explanation', answered(MINILAB_PROMPTS.membrane.id)],
              ['cell', 'Lab 2 explanation', answered(MINILAB_PROMPTS.cell.id)],
              ...(honors ? [['psi', 'Lab 3 explanation (Honors)', answered(MINILAB_PROMPTS.psi.id)]] : []),
            ] as [Tab, string, boolean][]).filter(([, , done]) => !done).map(([id, label], i) => (
              <span key={id}>{i > 0 && ', '}<button onClick={() => { setTab(id); requestAnimationFrame(() => document.getElementById(`q-${MINILAB_PROMPTS[id].id}`)?.focus()); }}>{label}</button></span>
            ))}
          </p>
        )}
      </section>
    </div>
  );
}

// ---------------- Membrane chamber ----------------

const MODES: { id: Mode; label: string; desc: string }[] = [
  { id: 'bilayer', label: 'Lipid bilayer only', desc: 'Water squeezes through the oily middle slowly. O₂ slips through easily. Ions are blocked.' },
  { id: 'aquaporin', label: 'Bilayer + aquaporins', desc: 'Like a real cell: water still crosses the lipid, but aquaporin channels add fast lanes. Ions are still blocked.' },
  { id: 'leaky', label: 'Leaky (damaged) membrane', desc: 'Holes in the membrane: ions can cross too.' },
];

const PRESET_ORDER: Preset[] = ['salt_left', 'salt_right', 'equal_salt', 'very_salty_left', 'pure'];

function tonicityWord(w: World, side: Side): string {
  const conc = (s: Side) => w.macro.ions[s] / Math.max(1, w.macro.water[s] + w.macro.ions[s]);
  const a = conc(side);
  const b = conc(side === 0 ? 1 : 0);
  if (Math.abs(a - b) < 0.012) return 'isotonic';
  return a > b ? 'hypertonic' : 'hypotonic';
}

function MembraneLab() {
  const reduceMotion = saved.value.reduceMotion;
  const ref = useRef<HTMLCanvasElement>(null);
  const [mode, setModeState] = useState<Mode>('aquaporin');
  const [preset, setPreset] = useState<Preset>('salt_left');
  const world = useRef<World>(createChamber('aquaporin', 'salt_left', 7));
  const membraneImg = useRef<ReturnType<typeof renderMembrane> | null>(null);
  const [stats, setStats] = useState(() => summarize(world.current));
  const [running, setRunning] = useState(!reduceMotion);
  const [fast, setFast] = useState(false);
  const fastRef = useRef(fast);
  fastRef.current = fast;
  const C = CHAMBER;

  const rebuildMembrane = () => {
    const w = world.current;
    membraneImg.current = renderMembrane({
      lf: leftFace(w), rf: rightFace(w), y0: 0, y1: C.height, scale: 1, dpr: pixelRatio(),
      channels: w.o.channels, gaps: w.o.gaps, showChannels: w.o.mode !== 'bilayer', showGaps: w.o.mode === 'leaky',
    });
  };

  const draw = () => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = pixelRatio();
    const w = world.current;
    const cs = getComputedStyle(canvas);
    const col = (n: string) => cs.getPropertyValue(n).trim();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const side of [0, 1] as Side[]) {
      const x0 = side === 0 ? 0 : rightFace(w);
      const x1 = side === 0 ? leftFace(w) : C.width;
      const t = top(w, side);
      ctx.fillStyle = col('--water-fill');
      ctx.fillRect(x0 * dpr, t * dpr, (x1 - x0) * dpr, (C.height - t) * dpr);
      ctx.fillStyle = col('--water');
      ctx.fillRect(x0 * dpr, t * dpr - dpr, (x1 - x0) * dpr, 2 * dpr);
    }
    if (!membraneImg.current) rebuildMembrane();
    const m = membraneImg.current!;
    ctx.drawImage(m.canvas, m.x * dpr, m.y * dpr);
    drawParticles(ctx, w, 1, dpr);
    // Headcount of WATER on each side, like a tally board.
    ctx.textAlign = 'center';
    for (const side of [0, 1] as Side[]) {
      const cx = side === 0 ? leftFace(w) / 2 : (rightFace(w) + C.width) / 2;
      ctx.fillStyle = col('--ink');
      ctx.font = `800 ${30 * dpr}px system-ui, sans-serif`;
      ctx.fillText(String(count(w, 'water', side)), cx * dpr, 36 * dpr);
      ctx.font = `700 ${10.5 * dpr}px system-ui, sans-serif`;
      ctx.fillStyle = col('--muted');
      ctx.fillText(`WATER · ${tonicityWord(w, side).toUpperCase()}`, cx * dpr, 52 * dpr);
    }
    // Net arrow from the last 10 s of crossings.
    const r = recent(w, 10);
    const net = r.toRight - r.toLeft;
    if (Math.abs(net) >= 3) {
      const cx = C.membraneX * dpr;
      const y = 78 * dpr;
      const dir = Math.sign(net);
      ctx.strokeStyle = COLORS.glowIn;
      ctx.fillStyle = COLORS.glowIn;
      ctx.lineWidth = 5 * dpr;
      ctx.beginPath();
      ctx.moveTo(cx - dir * 34 * dpr, y);
      ctx.lineTo(cx + dir * 24 * dpr, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + dir * 38 * dpr, y);
      ctx.lineTo(cx + dir * 22 * dpr, y - 10 * dpr);
      ctx.lineTo(cx + dir * 22 * dpr, y + 10 * dpr);
      ctx.fill();
      ctx.font = `700 ${11 * dpr}px system-ui, sans-serif`;
      ctx.fillText(`net ${Math.abs(net)} ${dir > 0 ? '→' : '←'}`, cx, y + 24 * dpr);
    }
  };

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = pixelRatio();
    canvas.width = C.width * dpr;
    canvas.height = C.height * dpr;
    rebuildMembrane();
    draw();
  }, []);

  useEffect(() => {
    if (!running || !ref.current) return;
    let n = 0;
    return frameLoop(ref.current, (dt) => {
      const steps = fastRef.current ? 5 : 1;
      for (let i = 0; i < steps; i++) step(world.current, dt);
      draw();
      if (++n % 12 === 0) setStats(summarize(world.current));
    });
  }, [running]);

  const advance = (seconds: number) => {
    for (let i = 0; i < seconds * 20; i++) step(world.current, 1 / 20);
    draw();
    setStats(summarize(world.current));
  };
  const reset = (p: Preset = preset, m: Mode = mode) => {
    world.current = createChamber(m, p, (Date.now() % 100000) | 0);
    rebuildMembrane();
    draw();
    setStats(summarize(world.current));
  };
  const changeMode = (m: Mode) => {
    setModeState(m);
    setMode(world.current, m);
    rebuildMembrane();
    draw();
  };
  const choosePreset = (p: Preset) => {
    setPreset(p);
    reset(p, mode);
  };

  return (
    <div class="grid-sim">
      <section class="panel">
        <h3>Membrane chamber</h3>
        <div class="presets" role="group" aria-label="Starting solutions">
          {PRESET_ORDER.map((p) => (
            <button key={p} class={`pill ${preset === p ? 'on' : ''}`} aria-pressed={preset === p} onClick={() => choosePreset(p)}>
              {PRESETS[p].label}
            </button>
          ))}
        </div>
        <canvas ref={ref} class="chamber" style={{ aspectRatio: `${C.width} / ${C.height}` }} role="img"
          aria-label={`Two chambers. Left: ${stats.lw} water, ${stats.li} salt ions, level ${stats.ll}%. Right: ${stats.rw} water, ${stats.ri} salt ions, level ${stats.rl}%. ${stats.levelText}`} />
        <ul class="legend">
          <li><img src={legendIcon('water')} alt="" /> water</li>
          <li><img src={legendIcon('na')} alt="" /> Na⁺</li>
          <li><img src={legendIcon('cl')} alt="" /> Cl⁻</li>
          <li><img src={legendIcon('o2')} alt="" /> O₂</li>
          <li><span class="ring" /> just crossed</li>
        </ul>
        <div class="row controls">
          {running ? (
            <button class="secondary" onClick={() => setRunning(false)}>⏸ Pause</button>
          ) : (
            <button class="secondary" onClick={() => setRunning(true)}>▶ Run</button>
          )}
          <label class="toggle"><input type="checkbox" checked={fast} onChange={(e) => setFast((e.target as HTMLInputElement).checked)} /> Fast-forward ×5</label>
          <button class="secondary" onClick={() => advance(30)}>Skip ahead 30 s</button>
          <button class="ghost" onClick={() => { world.current = addOxygenTo(world.current); draw(); }}>+ O₂ on left</button>
          <button class="ghost" onClick={() => reset()}>Reset</button>
        </div>
        <p class="fineprint">
          Water levels show what a real solution does on average (trillions of molecules). The dots are a small sample:
          each one wanders at random and can cross either way.
        </p>
      </section>
      <section class="panel">
        <fieldset class="modes">
          <legend>Membrane type</legend>
          {MODES.map((m) => (
            <label key={m.id} class="radio">
              <input type="radio" name="mode" checked={mode === m.id} onChange={() => changeMode(m.id)} />
              <span><strong>{m.label}</strong><br /><small>{m.desc}</small></span>
            </label>
          ))}
        </fieldset>
        <table class="counts-table">
          <thead><tr><th /><th scope="col">Left</th><th scope="col">Right</th></tr></thead>
          <tbody>
            <tr><th scope="row">Water molecules</th><td>{stats.lw}</td><td>{stats.rw}</td></tr>
            <tr><th scope="row">Salt ions (Na⁺ + Cl⁻)</th><td>{stats.li}</td><td>{stats.ri}</td></tr>
            <tr><th scope="row">Water level</th><td>{stats.ll}%</td><td>{stats.rl}%</td></tr>
          </tbody>
        </table>
        <table class="counts-table">
          <caption>Water crossings, last 10 s</caption>
          <tbody>
            <tr><th scope="row">through aquaporins</th><td>{stats.ch}</td></tr>
            <tr><th scope="row">through the lipid bilayer</th><td>{stats.bl}</td></tr>
            {mode === 'leaky' && <tr><th scope="row">through holes</th><td>{stats.gap}</td></tr>}
            <tr><th scope="row">left → right</th><td>{stats.toR}</td></tr>
            <tr><th scope="row">right → left</th><td>{stats.toL}</td></tr>
          </tbody>
        </table>
        <p class="netflow" aria-live="polite">{stats.levelText}</p>
        <Prompt id={MINILAB_PROMPTS.membrane.id} label={MINILAB_PROMPTS.membrane.label} rows={4} tag="Practice" />
      </section>
    </div>
  );
}

function addOxygenTo(w: World): World {
  addOxygen(w, 0, 10);
  return w;
}

function summarize(w: World) {
  const r = recent(w, 10);
  const ll = Math.round(level(w, 0) * 100);
  const rl = Math.round(level(w, 1) * 100);
  const levelText = Math.abs(ll - rl) < 2 ? 'The water levels are about equal.' : ll > rl ? 'The LEFT side has risen.' : 'The RIGHT side has risen.';
  return {
    lw: count(w, 'water', 0), rw: count(w, 'water', 1),
    li: count(w, 'ions', 0), ri: count(w, 'ions', 1),
    ll, rl, levelText,
    ch: r.channel, bl: r.bilayer, gap: r.gap, toR: r.toRight, toL: r.toLeft,
  };
}

// ---------------- Cell in a beaker ----------------

function CellLab() {
  const s = saved.value;
  const [pct, setPct] = useState(0.9);
  const [plant, setPlant] = useState(false);
  const [shown, setShown] = useState(1);
  const shownRef = useRef(1);
  const osm = nacl_mOsm(pct);
  const t = tonicity(osm);
  const target = plant ? plantCellVolume(osm) : animalCellVolume(osm);
  const aState = animalCellState(animalCellVolume(osm));
  const pState = plantCellState(osm);

  useEffect(() => {
    if (!s.cellSeen[t]) update((st) => ({ cellSeen: { ...st.cellSeen, [t]: true } }));
  }, [t]);

  // Animate toward the target volume.
  useEffect(() => {
    const goal = Math.min(target, RBC_LYSIS_RELATIVE_VOLUME);
    if (s.reduceMotion) { shownRef.current = goal; setShown(goal); return; }
    let raf = 0;
    let v = shownRef.current;
    const loop = () => {
      v += (goal - v) * 0.08;
      if (Math.abs(v - goal) <= 0.002) v = goal;
      shownRef.current = v;
      setShown(v);
      if (v !== goal) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [target, s.reduceMotion]);

  const lysed = !plant && aState === 'lysed' && shown >= RBC_LYSIS_RELATIVE_VOLUME - 0.01;
  const r = 52 * Math.cbrt(shown);
  const seenAll = s.cellSeen.hypotonic && s.cellSeen.isotonic && s.cellSeen.hypertonic;
  const arrowDir = t === 'hypotonic' ? 'in' : t === 'hypertonic' ? 'out' : 'both';
  const stateWord = plant
    ? { turgid: 'turgid (swollen, pressing on the wall)', normal: 'normal', plasmolyzed: 'plasmolyzed (membrane pulled away from the wall)' }[pState]
    : { lysed: 'burst (lysed)', swollen: 'swollen', normal: 'normal', shrunken: 'shrunken (crenated)' }[aState];
  const label = (name: string, key: keyof typeof s.cellSeen) => (s.cellSeen[key] ? name : '???');

  return (
    <div class="grid-sim">
      <section class="panel">
        <h3>A single cell in a beaker</h3>
        <svg viewBox="0 0 300 260" class="beaker" role="img"
          aria-label={`A ${plant ? 'plant' : 'red blood'} cell in ${pct.toFixed(1)} percent salt water. The cell is ${stateWord}.`}>
          <path d="M40 20 L40 230 Q40 245 55 245 L245 245 Q260 245 260 230 L260 20" class="glass" />
          <rect x="42" y={60} width="216" height="183" class="solution" style={{ opacity: 0.25 + Math.min(0.6, pct / 6) }} />
          {plant && (
            <rect x={150 - 62} y={150 - 62} width="124" height="124" rx="10" class="wall" />
          )}
          {lysed ? (
            <g class="lysed">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => {
                const a = (i / 7) * Math.PI * 2;
                return <path key={i} d={`M${150 + Math.cos(a) * 40} ${150 + Math.sin(a) * 40} q ${Math.cos(a + 1) * 14} ${Math.sin(a + 1) * 14} ${Math.cos(a) * 24} ${Math.sin(a) * 24}`} class="cell-membrane" />;
              })}
              <text x="150" y="155" text-anchor="middle" class="svg-label">burst!</text>
            </g>
          ) : plant ? (
            <rect x={150 - r * 1.05} y={150 - r * 1.05} width={r * 2.1} height={r * 2.1} rx={pState === 'plasmolyzed' ? 30 : 10} class="cell-plant" />
          ) : (
            <ellipse cx="150" cy="150" rx={r * (aState === 'shrunken' ? 1.0 : 1.15)} ry={r * (aState === 'shrunken' ? 0.9 : 0.85)} class={`cell-rbc ${aState === 'shrunken' ? 'crenated' : ''}`} />
          )}
          {!lysed && arrowDir !== 'both' && (
            <g class="water-arrows">
              {[0, 1, 2, 3].map((i) => {
                const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
                const inner = r + 8;
                const outer = r + 34;
                const [x0, y0, x1, y1] = arrowDir === 'in'
                  ? [150 + Math.cos(a) * outer, 150 + Math.sin(a) * outer, 150 + Math.cos(a) * inner, 150 + Math.sin(a) * inner]
                  : [150 + Math.cos(a) * inner, 150 + Math.sin(a) * inner, 150 + Math.cos(a) * outer, 150 + Math.sin(a) * outer];
                return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} marker-end="url(#arrowhead)" />;
              })}
            </g>
          )}
          <defs>
            <marker id="arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" class="arrowhead" />
            </marker>
          </defs>
        </svg>
        <p class="muted small">Arrows show NET water movement. Water still moves both ways across the membrane.</p>
      </section>
      <section class="panel">
        <label class="slider">
          Salt (NaCl) outside the cell: <strong>{pct.toFixed(1)}%</strong> ({osm.toFixed(0)} mOsm/L; cell inside ≈ {CELL_INSIDE_mOsm})
          <input type="range" min={0} max={5} step={0.1} value={pct} onInput={(e) => setPct(+(e.target as HTMLInputElement).value)} />
        </label>
        <label class="checkbox">
          <input type="checkbox" checked={plant} onChange={(e) => setPlant((e.target as HTMLInputElement).checked)} />
          Compare: plant cell (has a cell wall)
        </label>
        <div class="readouts inline">
          <div class="readout"><span class="readout-label">Cell</span><span class="readout-value small">{stateWord}</span></div>
          <div class="readout"><span class="readout-label">Relative volume</span><span class="readout-value">{Number.isFinite(target) ? `${Math.round(Math.min(target, 9.99) * 100)}%` : '—'}</span></div>
        </div>
        <table class="vocab">
          <caption>Solution compared with the inside of the cell</caption>
          <tbody>
            <tr class={t === 'hypotonic' ? 'now' : ''}><th scope="row">{label('Hypotonic', 'hypotonic')}</th><td>{s.cellSeen.hypotonic ? 'Less solute outside → net water moves IN' : 'Find a salt level where the cell swells.'}</td></tr>
            <tr class={t === 'isotonic' ? 'now' : ''}><th scope="row">{label('Isotonic', 'isotonic')}</th><td>{s.cellSeen.isotonic ? 'Equal solute → no net water movement' : 'Find a salt level where nothing changes.'}</td></tr>
            <tr class={t === 'hypertonic' ? 'now' : ''}><th scope="row">{label('Hypertonic', 'hypertonic')}</th><td>{s.cellSeen.hypertonic ? 'More solute outside → net water moves OUT' : 'Find a salt level where the cell shrinks.'}</td></tr>
          </tbody>
        </table>
        {seenAll && <p class="good">You found all three. Now connect them to Juniper.</p>}
        <Prompt id={MINILAB_PROMPTS.cell.id} label={MINILAB_PROMPTS.cell.label} rows={4} tag="Practice" />
      </section>
    </div>
  );
}

// ---------------- Water potential (extension) ----------------

function PsiLab() {
  const [temp, setTemp] = useState(38.9);
  const [bloodM, setBloodM] = useState(0.11);
  const [cellM, setCellM] = useState(0.145);
  const psiBlood = solutePotential(2, bloodM, temp);
  const psiCell = solutePotential(2, cellM, temp);
  const dir = Math.abs(psiBlood - psiCell) < 0.05 ? 'no net movement' : psiBlood > psiCell ? 'from blood → into brain cells' : 'from brain cells → into blood';
  const num = (label: string, v: number, set: (n: number) => void, stepV: number, unit: string) => (
    <label class="numfield">
      {label}
      <span><input type="number" step={stepV} value={v} onInput={(e) => { const n = parseFloat((e.target as HTMLInputElement).value); if (Number.isFinite(n) && n >= 0) set(n); }} /> {unit}</span>
    </label>
  );
  return (
    <div class="grid2">
      <section class="panel">
        <h3>Water potential <span class="purpose purpose-extension">Honors: required · Others: optional</span></h3>
        <p>Solute potential: <strong>Ψ<sub>s</sub> = −iCRT</strong></p>
        <ul class="small">
          <li><strong>i</strong> = ionization constant (NaCl splits into 2 ions, so i = 2)</li>
          <li><strong>C</strong> = molar concentration (mol/L)</li>
          <li><strong>R</strong> = 0.0831 L·bar/(mol·K)</li>
          <li><strong>T</strong> = temperature in kelvin (°C + 273)</li>
        </ul>
        <p class="small">Water moves from <strong>higher</strong> (less negative) water potential to <strong>lower</strong> (more negative) water potential.</p>
        {num('Body temperature', temp, setTemp, 0.1, '°C')}
        {num('Juniper\'s blood NaCl-equivalent', bloodM, setBloodM, 0.005, 'mol/L')}
        {num('Brain cell solute (as NaCl-equivalent)', cellM, setCellM, 0.005, 'mol/L')}
        <p class="muted small">Starting values: Juniper's blood sodium is about 0.110 mol/L. Brain cells still hold solute equal to about 0.145 mol/L. These are simplified, and real body fluids contain many solutes.</p>
      </section>
      <section class="panel">
        <div class="readouts">
          <div class="readout"><span class="readout-label">Ψs blood</span><span class="readout-value">{psiBlood.toFixed(2)} <small>bar</small></span></div>
          <div class="readout"><span class="readout-label">Ψs brain cells</span><span class="readout-value">{psiCell.toFixed(2)} <small>bar</small></span></div>
          <div class="readout"><span class="readout-label">Predicted net water movement</span><span class="readout-value small">{dir}</span></div>
        </div>
        <details>
          <summary>Show one worked example</summary>
          <p class="small">Blood: Ψs = −(2)(0.110)(0.0831)(38.9 + 273.15) = {solutePotential(2, 0.11, 38.9).toFixed(2)} bar.</p>
        </details>
        <Prompt id={MINILAB_PROMPTS.psi.id} label={MINILAB_PROMPTS.psi.label} rows={3} tag="Honors" optional={!saved.value.honors} />
      </section>
    </div>
  );
}
