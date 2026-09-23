import { useEffect, useRef, useState } from 'preact/hooks';
import { MINILAB_PROMPTS } from '../../content/case';
import {
  addParticles, createChamber, stepChamber, count, waterLevel, AQUAPORIN_BANDS, MEMBRANE_X,
  type Chamber, type MembraneMode, type ParticleKind, type Side,
} from '../../engine/chamber';
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
    ['psi', '3 · Water potential (extension)'],
  ];
  const coreDone = answered(MINILAB_PROMPTS.membrane.id, 30) && answered(MINILAB_PROMPTS.cell.id, 30);
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
        <p class="muted">Mini-labs 1 and 2 are required. Lab 3 is an optional extension.</p>
        <button class="primary" disabled={!coreDone} onClick={() => goTo(4)}>Build the causal chain →</button>
      </section>
    </div>
  );
}

// ---------------- Membrane chamber ----------------

const MODES: { id: MembraneMode; label: string; desc: string }[] = [
  { id: 'bilayer', label: 'Lipid bilayer only', desc: 'Small nonpolar molecules like O₂ slip through. Water crosses only slowly. Ions are blocked.' },
  { id: 'aquaporin', label: 'Bilayer + aquaporins', desc: 'Like a real cell membrane: aquaporin channels let water through quickly. Ions are still blocked.' },
  { id: 'leaky', label: 'Leaky (damaged) membrane', desc: 'Large holes: everything, including Na⁺, can cross.' },
];

function MembraneLab() {
  const reduceMotion = saved.value.reduceMotion;
  const ref = useRef<HTMLCanvasElement>(null);
  const chamber = useRef<Chamber>(createChamber(Date.now() % 100000, 50, 'aquaporin'));
  const smooth = useRef({ left: 0.6, right: 0.6 });
  const [mode, setMode] = useState<MembraneMode>('aquaporin');
  const [stats, setStats] = useState(() => summarize(chamber.current));
  const [running, setRunning] = useState(!reduceMotion);

  const draw = () => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const W = 560;
    const H = 300;
    const cs = getComputedStyle(canvas);
    const col = (n: string) => cs.getPropertyValue(n).trim();
    ctx.clearRect(0, 0, W, H);
    const c = chamber.current;
    for (const side of ['left', 'right'] as Side[]) {
      const target = waterLevel(c, side);
      smooth.current[side] += (target - smooth.current[side]) * 0.05;
      const lvl = smooth.current[side];
      const x0 = side === 'left' ? 0 : W * MEMBRANE_X;
      ctx.fillStyle = col('--water-fill');
      ctx.fillRect(x0, H * (1 - lvl), W / 2, H * lvl);
      ctx.strokeStyle = col('--water');
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x0, H * (1 - lvl));
      ctx.lineTo(x0 + W / 2, H * (1 - lvl));
      ctx.stroke();
    }
    ctx.fillStyle = col('--barrier');
    ctx.fillRect(W * MEMBRANE_X - 5, 0, 10, H);
    if (c.mode === 'aquaporin') {
      ctx.fillStyle = col('--channel');
      for (const [a, b] of AQUAPORIN_BANDS) ctx.fillRect(W * MEMBRANE_X - 5, H * a, 10, H * (b - a));
    }
    if (c.mode === 'leaky') {
      ctx.fillStyle = col('--water-fill');
      for (let y = 0.1; y < 1; y += 0.12) ctx.fillRect(W * MEMBRANE_X - 5, H * y, 10, H * 0.06);
    }
    for (const p of c.particles) {
      ctx.fillStyle = p.kind === 'water' ? col('--water') : p.kind === 'sodium' ? col('--sodium') : col('--oxygen');
      ctx.beginPath();
      ctx.arc(p.x * W, p.y * H, p.kind === 'water' ? 3 : 5.5, 0, Math.PI * 2);
      ctx.fill();
      if (p.kind !== 'water') {
        ctx.strokeStyle = col('--ink');
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  };

  useEffect(() => {
    const canvas = ref.current;
    if (canvas) {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = 560 * dpr;
      canvas.height = 300 * dpr;
      canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    draw();
  }, []);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    let n = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden) { last = now; return; }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      chamber.current = stepChamber(chamber.current, dt);
      draw();
      if (++n % 15 === 0) setStats(summarize(chamber.current));
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  const advance = (seconds: number) => {
    for (let i = 0; i < seconds * 30; i++) chamber.current = stepChamber(chamber.current, 1 / 30);
    smooth.current = { left: waterLevel(chamber.current, 'left'), right: waterLevel(chamber.current, 'right') };
    draw();
    setStats(summarize(chamber.current));
  };

  const add = (kind: ParticleKind, side: Side) => {
    chamber.current = addParticles(chamber.current, kind, side, kind === 'sodium' ? 12 : 8);
    draw();
    setStats(summarize(chamber.current));
  };
  const reset = (m: MembraneMode = mode) => {
    chamber.current = createChamber(Date.now() % 100000, 50, m);
    smooth.current = { left: 0.6, right: 0.6 };
    draw();
    setStats(summarize(chamber.current));
  };
  const changeMode = (m: MembraneMode) => {
    setMode(m);
    chamber.current = { ...chamber.current, mode: m };
    draw();
  };

  return (
    <div class="grid-sim">
      <section class="panel">
        <h3>Membrane chamber</h3>
        <canvas ref={ref} class="chamber" style={{ aspectRatio: '560 / 300' }} role="img"
          aria-label={`Two chambers. Left: ${stats.lw} water, ${stats.ln} sodium, ${stats.lo} oxygen. Right: ${stats.rw} water, ${stats.rn} sodium, ${stats.ro} oxygen. ${stats.levelText}`} />
        <ul class="legend">
          <li><span class="dot dot-water" /> water</li>
          <li><span class="dot dot-na" /> Na⁺</li>
          <li><span class="dot dot-o2" /> O₂</li>
          <li><span class="swatch swatch-channel" /> aquaporin</li>
        </ul>
        <div class="row controls">
          {running ? (
            <button class="secondary" onClick={() => setRunning(false)}>⏸ Pause</button>
          ) : (
            <button class="secondary" onClick={() => setRunning(true)}>▶ Run</button>
          )}
          <button class="secondary" onClick={() => advance(20)}>Skip ahead 20 s</button>
          <button class="ghost" onClick={() => reset()}>Reset</button>
        </div>
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
        <div class="adders">
          <span>Add to left:</span>
          <button onClick={() => add('sodium', 'left')}>+ Na⁺</button>
          <button onClick={() => add('oxygen', 'left')}>+ O₂</button>
          <span>Add to right:</span>
          <button onClick={() => add('sodium', 'right')}>+ Na⁺</button>
          <button onClick={() => add('oxygen', 'right')}>+ O₂</button>
        </div>
        <table class="counts-table">
          <thead><tr><th /><th scope="col">Left</th><th scope="col">Right</th></tr></thead>
          <tbody>
            <tr><th scope="row">Water</th><td>{stats.lw}</td><td>{stats.rw}</td></tr>
            <tr><th scope="row">Na⁺</th><td>{stats.ln}</td><td>{stats.rn}</td></tr>
            <tr><th scope="row">O₂</th><td>{stats.lo}</td><td>{stats.ro}</td></tr>
            <tr><th scope="row">Water crossings →</th><td colspan={2}>{stats.toRight} left→right · {stats.toLeft} right→left</td></tr>
          </tbody>
        </table>
        <p class="netflow" aria-live="polite">{stats.levelText}</p>
        <Prompt id={MINILAB_PROMPTS.membrane.id} label={MINILAB_PROMPTS.membrane.label} minChars={30} rows={4} tag="Practice" />
      </section>
    </div>
  );
}

function summarize(c: Chamber) {
  const lw = count(c, 'water', 'left');
  const rw = count(c, 'water', 'right');
  const diff = lw - rw;
  const levelText = Math.abs(diff) < 6 ? 'Water levels are about equal.' : diff > 0 ? 'The LEFT side has gained water.' : 'The RIGHT side has gained water.';
  return {
    lw, rw,
    ln: count(c, 'sodium', 'left'), rn: count(c, 'sodium', 'right'),
    lo: count(c, 'oxygen', 'left'), ro: count(c, 'oxygen', 'right'),
    toRight: c.crossings.toRight, toLeft: c.crossings.toLeft, levelText,
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
        <Prompt id={MINILAB_PROMPTS.cell.id} label={MINILAB_PROMPTS.cell.label} minChars={30} rows={4} tag="Practice" />
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
        <h3>Water potential (extension)</h3>
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
        <Prompt id={MINILAB_PROMPTS.psi.id} label={MINILAB_PROMPTS.psi.label} rows={3} tag="Extension" />
      </section>
    </div>
  );
}
