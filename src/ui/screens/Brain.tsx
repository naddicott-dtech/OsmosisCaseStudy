import { useEffect, useRef, useState } from 'preact/hooks';
import { BRAIN_EXPLAIN, BRAIN_PREDICTION } from '../../content/case';
import { createPatient, step, MODEL, type PhysState } from '../../engine/physiology';
import { saved, update, goTo } from '../../state';
import { BrainCanvas } from '../BrainCanvas';
import { ActivityTrace, PressureGauge, Prompt, Readout, answered, naTone } from '../widgets';

const SIM_MIN_PER_SEC = 3;
const RAMP_MIN = 30;
const REPLAY_END_MIN = 90;

type Mode = 'idle' | 'replay' | 'done' | 'explore';

export function Brain() {
  const s = saved.value;
  const [mode, setMode] = useState<Mode>(s.brainWatched ? 'done' : 'idle');
  const [phys, setPhys] = useState<PhysState>(() => (s.brainWatched ? createPatient(110) : createPatient(MODEL.healthyNa)));
  const [exploreNa, setExploreNa] = useState(110);
  const [resetKey, setResetKey] = useState(0);
  const physRef = useRef(phys);
  physRef.current = phys;
  const exploreRef = useRef(exploreNa);
  exploreRef.current = exploreNa;

  useEffect(() => {
    if (mode !== 'replay' && mode !== 'explore') return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000) * SIM_MIN_PER_SEC;
      last = now;
      if (document.hidden) return;
      const cur = physRef.current;
      if (mode === 'replay') {
        const t = cur.timeMin + dt;
        const na = MODEL.healthyNa - (MODEL.healthyNa - MODEL.initialNa) * Math.min(1, t / RAMP_MIN);
        const next = step(cur, dt, na);
        setPhys(next);
        if (next.timeMin >= REPLAY_END_MIN) {
          setMode('done');
          update(() => ({ brainWatched: true }));
        }
      } else {
        setPhys(step(cur, dt, exploreRef.current));
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [mode]);

  const replay = () => {
    setPhys(createPatient(MODEL.healthyNa));
    setResetKey((k) => k + 1);
    setMode('replay');
  };

  const skip = () => {
    let p = physRef.current;
    while (p.timeMin < REPLAY_END_MIN) {
      const na = MODEL.healthyNa - (MODEL.healthyNa - MODEL.initialNa) * Math.min(1, (p.timeMin + 1) / RAMP_MIN);
      p = step(p, 1, na);
    }
    setPhys(p);
    setMode('done');
    update(() => ({ brainWatched: true }));
  };

  const pred = s.brainPrediction;
  const hh = Math.floor(phys.timeMin / 60);
  const mm = Math.floor(phys.timeMin % 60).toString().padStart(2, '0');

  return (
    <div class="stack">
      <section class="panel">
        <p class="muted">
          Zoom in on the boundary between a tiny blood vessel (capillary) and a brain cell. Water crosses this barrier
          two ways: <strong>slowly, straight through the lipid bilayer</strong>, and <strong>quickly, through aquaporins</strong>
          (protein water channels). Sodium and chloride ions cannot cross it quickly.
        </p>
        {!pred && (
          <fieldset class="mc">
            <legend><span class="purpose purpose-check">Predict</span> {BRAIN_PREDICTION.question}</legend>
            {BRAIN_PREDICTION.choices.map((c) => (
              <button key={c.id} class="choice" onClick={() => update(() => ({ brainPrediction: c.id }))}>{c.text}</button>
            ))}
          </fieldset>
        )}
        {pred && (
          <p class="callout">
            <strong>Your prediction:</strong> {BRAIN_PREDICTION.choices.find((c) => c.id === pred)?.text}.{' '}
            {mode !== 'idle' && BRAIN_PREDICTION.feedback[pred]}
          </p>
        )}
      </section>

      <div class="grid-sim">
        <section class="panel">
          <BrainCanvas plasmaNa={phys.plasmaNa} brainVolume={phys.brainVolume} flux={phys.flux}
            reduceMotion={s.reduceMotion} resetKey={resetKey} />
          <div class="row controls">
            <button class="primary" disabled={!pred || mode === 'replay'} onClick={replay}>
              {mode === 'idle' ? '▶ Play: Juniper drinks plain water' : '↺ Replay'}
            </button>
            {mode === 'replay' && <button class="secondary" onClick={skip}>Skip to end</button>}
            <span class="clock" aria-live="off">Model time {hh}:{mm}</span>
          </div>
        </section>
        <section class="panel readouts">
          <Readout label="Blood sodium" value={phys.plasmaNa.toFixed(0)} unit="mEq/L" note="normal 134–144" tone={naTone(phys.plasmaNa)} />
          <Readout label="Brain cell swelling" value={`+${Math.max(0, (phys.brainVolume - 1) * 100).toFixed(1)}`} unit="%"
            tone={phys.brainVolume > 1.04 ? 'bad' : phys.brainVolume > 1.02 ? 'warn' : 'ok'} />
          <PressureGauge icp={phys.icp} />
          <ActivityTrace status={phys.status} reduceMotion={s.reduceMotion} />
        </section>
      </div>

      {(mode === 'done' || mode === 'explore') && (
        <section class="panel">
          <h3>What did you observe?</h3>
          <Prompt id={BRAIN_EXPLAIN.id} label={BRAIN_EXPLAIN.label} rows={4} tag="Practice" />
          <details class="explore" open={mode === 'explore'}>
            <summary>Explore: set the blood sodium yourself</summary>
            <p class="muted">Drag the slider to change the blood sodium. What happens at 140? At 160?</p>
            <label class="slider">
              Blood sodium: <strong>{exploreNa} mEq/L</strong>
              <input type="range" min={100} max={160} step={1} value={exploreNa}
                onInput={(e) => {
                  setExploreNa(+(e.target as HTMLInputElement).value);
                  if (mode !== 'explore') setMode('explore');
                }} />
            </label>
          </details>
          <div class="row">
            <button class="primary" disabled={!answered(BRAIN_EXPLAIN.id)} onClick={() => goTo(3)}>Go to the mini-labs →</button>
          </div>
        </section>
      )}
    </div>
  );
}
