import { useEffect, useRef, useState } from 'preact/hooks';
import { HEMOLYSIS_TEXT, OUTCOME_TEXT, REFLECT_PROMPT, TREAT_PREDICT_LABEL } from '../../content/case';
import {
  FLUIDS, MODEL, classifyOutcome, createPatient, startInfusion, step,
  type FluidId, type Outcome, type PhysState,
} from '../../engine/physiology';
import { saved, update, goTo, type TreatmentLog } from '../../state';
import { BrainCanvas } from '../BrainCanvas';
import { Calf, CALF_LABEL } from '../Calf';
import { ActivityTrace, LineChart, PressureGauge, Prompt, Readout, answered, naTone } from '../widgets';

const VOLUMES = [0.25, 0.5, 1, 2];
const ORDER_MIN = 360; // 1 h infusion + 5 h observation
const SIM_MIN_PER_SEC = 12;
const EFFECTS = [
  { id: 'in', text: 'More water will move INTO the brain (worse)' },
  { id: 'none', text: 'Little or no change' },
  { id: 'out', text: 'Water will move OUT of the brain (better)' },
];

export function Treat() {
  const s = saved.value;
  const patient = s.patient;
  const [fluid, setFluid] = useState<FluidId | null>(null);
  const [volume, setVolume] = useState<number | null>(null);
  const [effect, setEffect] = useState<string | null>(null);
  const [why, setWhy] = useState('');
  const [running, setRunning] = useState(false);
  const [live, setLive] = useState<PhysState>(patient);
  const [series, setSeries] = useState<{ na: [number, number][]; icp: [number, number][] }>({
    na: [[patient.timeMin, patient.plasmaNa]], icp: [[patient.timeMin, patient.icp]],
  });
  const [result, setResult] = useState<{ outcome: Outcome; hemolysis: boolean } | null>(null);
  const runRef = useRef<{ before: PhysState; endAt: number; cur: PhysState } | null>(null);

  const canOrder = !!fluid && !!volume && !!effect && why.trim().length >= 20 && !running;

  const finish = (after: PhysState) => {
    const run = runRef.current;
    if (!run) return;
    runRef.current = null;
    const outcome = classifyOutcome(run.before, after);
    const hemolysisNew = after.hemolysis && !run.before.hemolysis;
    const log: TreatmentLog = {
      trial: s.trial,
      fluid: fluid as FluidId,
      volumeL: volume as number,
      predictedEffect: effect as string,
      prediction: why.trim(),
      outcome: outcome.kind,
      naBefore: run.before.plasmaNa,
      naAfter: after.plasmaNa,
      icpBefore: run.before.icp,
      icpAfter: after.icp,
      hemolysis: hemolysisNew,
    };
    update((st) => ({ patient: after, treatments: [...st.treatments, log] }));
    setLive(after);
    setRunning(false);
    setResult({ outcome, hemolysis: hemolysisNew });
    setEffect(null);
    setWhy('');
  };

  const pushSeries = (p: PhysState) =>
    setSeries((sr) => ({ na: [...sr.na, [p.timeMin, p.plasmaNa]], icp: [...sr.icp, [p.timeMin, p.icp]] }));

  const order = () => {
    if (!canOrder || !fluid || !volume) return;
    const before = saved.value.patient;
    runRef.current = { before, endAt: before.timeMin + ORDER_MIN, cur: startInfusion(before, fluid, volume, 60) };
    setResult(null);
    setRunning(true);
    if (window.innerWidth < 900) document.getElementById('treat-patient')?.scrollIntoView({ block: 'start', behavior: saved.value.reduceMotion ? 'auto' : 'smooth' });
  };

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const run = runRef.current;
      if (!run) return;
      const dtMin = Math.min(0.1, (now - last) / 1000) * SIM_MIN_PER_SEC;
      last = now;
      if (document.hidden) return;
      const next = step(run.cur, Math.min(dtMin, run.endAt - run.cur.timeMin));
      run.cur = next;
      setLive(next);
      acc += dtMin;
      if (acc >= 5) { acc = 0; pushSeries(next); }
      if (next.timeMin >= run.endAt - 1e-6) { pushSeries(next); finish(next); }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  const skip = () => {
    const run = runRef.current;
    if (!run) return;
    let p = run.cur;
    const pts: PhysState[] = [];
    while (p.timeMin < run.endAt - 1e-6) {
      p = step(p, Math.min(5, run.endAt - p.timeMin));
      pts.push(p);
    }
    setSeries((sr) => ({
      na: [...sr.na, ...pts.map((q) => [q.timeMin, q.plasmaNa] as [number, number])],
      icp: [...sr.icp, ...pts.map((q) => [q.timeMin, q.icp] as [number, number])],
    }));
    run.cur = p;
    finish(p);
  };

  const newTrial = () => {
    const fresh = createPatient();
    update((st) => ({ patient: fresh, trial: st.trial + 1 }));
    setLive(fresh);
    setSeries({ na: [[0, fresh.plasmaNa]], icp: [[0, fresh.icp]] });
    setResult(null);
  };

  const shown = running ? live : patient;
  const trialLogs = s.treatments.filter((t) => t.trial === s.trial);
  const anySuccess = s.treatments.some((t) => t.outcome === 'success');
  const rise = shown.maxNaSinceStart - shown.naAtTreatmentStart;
  const xMax = Math.max(360, Math.ceil((series.na.at(-1)?.[0] ?? 0) / 60) * 60);

  return (
    <div class="stack">
      <div class="grid-sim">
        <section class="panel" id="treat-patient">
          <Calf status={shown.status} reduceMotion={s.reduceMotion} />
          <p class="status-line" aria-live="polite">{CALF_LABEL[shown.status]}</p>
          <BrainCanvas plasmaNa={shown.plasmaNa} brainVolume={shown.brainVolume} flux={shown.flux} reduceMotion={s.reduceMotion} />
        </section>
        <section class="panel">
          <h3>IV order: trial {s.trial}{trialLogs.length ? `, order ${trialLogs.length + 1}` : ''}</h3>
          <fieldset class="fluids" disabled={running}>
            <legend>1. Choose a fluid</legend>
            {(Object.keys(FLUIDS) as FluidId[]).map((id) => (
              <label key={id} class={`radio fluid ${fluid === id ? 'on' : ''}`}>
                <input type="radio" name="fluid" checked={fluid === id} onChange={() => setFluid(id)} />
                <span>
                  <strong>{FLUIDS[id].name}</strong>
                  <small>{FLUIDS[id].note}</small>
                  {!FLUIDS[id].clinical && <small class="warn-text">⚠ Not a real treatment. Included only to test a prediction.</small>}
                </span>
              </label>
            ))}
          </fieldset>
          <fieldset class="volumes" disabled={running}>
            <legend>2. Choose an amount (given over 1 hour)</legend>
            <div class="row">
              {VOLUMES.map((v) => (
                <label key={v} class={`pill ${volume === v ? 'on' : ''}`}>
                  <input type="radio" name="vol" checked={volume === v} onChange={() => setVolume(v)} />
                  {v < 1 ? `${v * 1000} mL` : `${v} L`}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset class="predict" disabled={running}>
            <legend>3. <span class="purpose purpose-check">Predict</span> {TREAT_PREDICT_LABEL}</legend>
            {EFFECTS.map((e) => (
              <label key={e.id} class="radio">
                <input type="radio" name="effect" checked={effect === e.id} onChange={() => setEffect(e.id)} />
                <span>{e.text}</span>
              </label>
            ))}
            <label for="treat-why" class="sr-only">Explain your prediction</label>
            <textarea id="treat-why" rows={2} placeholder="Because…" value={why}
              onInput={(ev) => setWhy((ev.target as HTMLTextAreaElement).value)} />
            <small class={why.trim().length >= 20 ? 'hint ok' : 'hint'}>
              {why.trim().length >= 20 ? 'Ready.' : `Explain your reasoning (${why.trim().length}/20 characters).`}
            </small>
          </fieldset>
          <div class="row">
            <button class="primary" disabled={!canOrder} onClick={order}>💉 Start IV</button>
            {running && <button class="secondary" onClick={skip}>Skip to result</button>}
            {running && <span class="clock">Infusing and observing… {(live.timeMin / 60).toFixed(1)} h</span>}
          </div>
        </section>
      </div>

      <div class="grid-sim">
        <section class="panel">
          <div class="charts">
            <LineChart title="Blood sodium" yLabel="mEq/L" yMin={100} yMax={145} xMax={xMax}
              series={[{ label: 'Na', points: series.na, cls: 'line-na' }]}
              bands={[{ from: 134, to: 145, cls: 'band-ok', label: 'normal' }]} />
            <LineChart title="Pressure inside skull" yLabel="mmHg" yMin={0} yMax={60} xMax={xMax}
              series={[{ label: 'ICP', points: series.icp, cls: 'line-icp' }]}
              bands={[{ from: MODEL.seizeAboveICP, to: 60, cls: 'band-bad', label: 'seizures' }]} />
          </div>
        </section>
        <section class="panel readouts">
          <Readout label="Blood sodium" value={shown.plasmaNa.toFixed(1)} unit="mEq/L" note="normal 134–144" tone={naTone(shown.plasmaNa)} />
          <Readout label="Sodium rise this trial" value={`${rise >= 0 ? '+' : ''}${rise.toFixed(1)}`} unit="mEq/L"
            note={`safe limit ≈ +${MODEL.maxSafeRise24h} in the first day`} tone={rise > MODEL.maxSafeRise24h ? 'bad' : rise > 7 ? 'warn' : 'ok'} />
          <PressureGauge icp={shown.icp} />
          <ActivityTrace status={shown.status} reduceMotion={s.reduceMotion} />
        </section>
      </div>

      {result && (
        <section class={`panel outcome outcome-${result.outcome.kind}`} role="status">
          <h3>{OUTCOME_TEXT[result.outcome.kind].title}</h3>
          <p>{OUTCOME_TEXT[result.outcome.kind].body}</p>
          {result.hemolysis && <p><strong>{HEMOLYSIS_TEXT}</strong></p>}
          <p class="small muted">
            Blood sodium {result.outcome.naChange >= 0 ? 'rose' : 'fell'} by {Math.abs(result.outcome.naChange).toFixed(1)} mEq/L.
            Skull pressure {result.outcome.icpChange >= 0 ? 'rose' : 'fell'} by {Math.abs(result.outcome.icpChange).toFixed(0)} mmHg.
          </p>
          <div class="row">
            <button class="secondary" onClick={() => setResult(null)}>Give another IV order (same patient)</button>
            <button class="ghost" onClick={newTrial}>Start a new trial with Juniper as she was at the start</button>
          </div>
        </section>
      )}

      {s.treatments.length > 0 && (
        <section class="panel">
          <h3>Treatment log</h3>
          <div class="table-wrap">
            <table class="log">
              <thead><tr><th scope="col">Trial</th><th scope="col">Fluid</th><th scope="col">Amount</th><th scope="col">You predicted</th><th scope="col">Na⁺ change</th><th scope="col">Result</th></tr></thead>
              <tbody>
                {s.treatments.map((t, i) => (
                  <tr key={i}>
                    <td>{t.trial}</td>
                    <td>{FLUIDS[t.fluid].short}</td>
                    <td>{t.volumeL < 1 ? `${t.volumeL * 1000} mL` : `${t.volumeL} L`}</td>
                    <td>{EFFECTS.find((e) => e.id === t.predictedEffect)?.text}</td>
                    <td>{(t.naAfter - t.naBefore >= 0 ? '+' : '') + (t.naAfter - t.naBefore).toFixed(1)}</td>
                    <td>{OUTCOME_TEXT[t.outcome].title}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {(anySuccess || s.treatments.length >= 3) && (
        <section class="panel">
          <Prompt id={REFLECT_PROMPT.id} label={REFLECT_PROMPT.label} minChars={40} rows={4} tag="Check" />
          {!anySuccess && <p class="muted small">Tip: you haven't stopped the seizures safely yet. You can keep experimenting.</p>}
          <button class="primary" disabled={!answered(REFLECT_PROMPT.id, 40)} onClick={() => goTo(6)}>Try a new patient: the marathon runner →</button>
        </section>
      )}
    </div>
  );
}
