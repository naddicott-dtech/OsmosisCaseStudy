import { useEffect, useRef, useState } from 'preact/hooks';
import { ENABLE_RUNNER, HEMOLYSIS_TEXT, OUTCOME_TEXT, REFLECT_PROMPT, TREAT_GOAL, TREAT_PREDICT_LABEL, VERDICT_TEXT } from '../../content/case';
import {
  FLUIDS, MAX_ROUNDS, MODEL, classifyOutcome, createPatient, startInfusion, step, trialVerdict,
  type FluidId, type Outcome, type PhysState,
} from '../../engine/physiology';
import { saved, update, goTo, type TreatmentLog, type TrialResult } from '../../state';
import { BrainCanvas } from '../BrainCanvas';
import { Calf, CALF_LABEL, type IVState } from '../Calf';
import { assessAnswer, RULES } from '../../quality';
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

  const whyCheck = assessAnswer(why, RULES.treat_why);
  const canOrder = !!fluid && !!volume && !!effect && whyCheck.ok && !running;

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
    const rounds = saved.value.treatments.filter((t) => t.trial === saved.value.trial).length + 1;
    const endedBy: TrialResult['endedBy'] | null = after.overcorrected ? 'overcorrected' : after.hemolysis ? 'student' : rounds >= MAX_ROUNDS ? 'max_rounds' : null;
    update((st) => ({
      patient: after,
      treatments: [...st.treatments, log],
      ...(endedBy ? { trialEnded: true, trialResults: [...st.trialResults, { trial: st.trial, rounds, summary: trialVerdict(after), endedBy }] } : {}),
    }));
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
    update((st) => ({ patient: fresh, trial: st.trial + 1, trialEnded: false }));
    setLive(fresh);
    setSeries({ na: [[0, fresh.plasmaNa]], icp: [[0, fresh.icp]] });
    setResult(null);
  };

  const endTrial = () => {
    const rounds = saved.value.treatments.filter((t) => t.trial === saved.value.trial).length;
    update((st) => ({ trialEnded: true, trialResults: [...st.trialResults, { trial: st.trial, rounds, summary: trialVerdict(st.patient), endedBy: 'student' }] }));
    setResult(null);
  };

  const shown = running ? live : patient;
  const TINT: Record<FluidId, string> = { sterile_water: '#bfe3ff', d5w: '#cfe8c8', saline_0_9: '#9fd0f5', saline_3: '#f6c46b' };
  const lastThisTrial = s.treatments.filter((t) => t.trial === s.trial).at(-1);
  const iv: IVState | null = running && live.infusion
    ? { label: FLUIDS[live.infusion.fluid].short, remaining: 1 - live.infusion.deliveredL / live.infusion.volumeL, running: true, tint: TINT[live.infusion.fluid] }
    : running && runRef.current
      ? { label: FLUIDS[fluid as FluidId].short, remaining: 0, running: false, tint: TINT[fluid as FluidId] }
      : lastThisTrial
        ? { label: FLUIDS[lastThisTrial.fluid].short, remaining: 0, running: false, tint: TINT[lastThisTrial.fluid] }
        : null;
  const trialLogs = s.treatments.filter((t) => t.trial === s.trial);
  const round = trialLogs.length + (running ? 0 : 1);
  const thisTrialResult = s.trialEnded ? s.trialResults.filter((r) => r.trial === s.trial).at(-1) : undefined;
  const anySafe = s.trialResults.some((r) => r.summary.verdict === 'safe');
  const canMoveOn = anySafe || s.trialResults.length >= 3;
  const stableNow = shown.status === 'stable' || shown.status === 'healthy';
  const showForm = !s.trialEnded && !result;
  const rise = shown.maxNaSinceStart - shown.naAtTreatmentStart;
  const xMax = Math.max(360, Math.ceil((series.na.at(-1)?.[0] ?? 0) / 60) * 60);

  return (
    <div class="stack">
      <section class="panel goal">
        <h3>{TREAT_GOAL.title}</h3>
        <ul>{TREAT_GOAL.points.map((p) => <li key={p}>{p}</li>)}</ul>
        <details>
          <summary>How treatment works</summary>
          <p>{TREAT_GOAL.how}</p>
        </details>
        <p class="small"><strong>{TREAT_GOAL.requirement}</strong>{' '}
          {s.trialResults.length > 0 && (
            <span>Your trials so far: {s.trialResults.map((r) => `#${r.trial} ${VERDICT_TEXT[r.summary.verdict].title.replace('Trial over: ', '')}`).join(' · ')}.</span>
          )}
        </p>
      </section>
      <div class="grid-sim">
        <section class="panel" id="treat-patient">
          <Calf status={shown.status} reduceMotion={s.reduceMotion} iv={iv} />
          <p class="status-line" aria-live="polite">{CALF_LABEL[shown.status]}</p>
          <BrainCanvas plasmaNa={shown.plasmaNa} brainVolume={shown.brainVolume} flux={shown.flux} reduceMotion={s.reduceMotion} compact resetKey={s.trial * 100 + trialLogs.length} />
        </section>
        <section class="panel">
          <div class="trial-head">
            <h3>Trial {s.trial}</h3>
            <ol class="rounds" aria-label={`Round ${Math.min(round, MAX_ROUNDS)} of ${MAX_ROUNDS}`}>
              {Array.from({ length: MAX_ROUNDS }, (_, i) => (
                <li key={i} class={i < trialLogs.length ? 'done' : i === trialLogs.length && !s.trialEnded ? 'now' : ''}>
                  Round {i + 1}
                </li>
              ))}
            </ol>
          </div>
          {thisTrialResult && <TrialScorecard r={thisTrialResult} onNew={newTrial} />}
          {!s.trialEnded && result && (
            <div class={`reassess outcome-${result.outcome.kind}`} role="status">
              <h4>Round {trialLogs.length} result: {OUTCOME_TEXT[result.outcome.kind].title}</h4>
              <p>{OUTCOME_TEXT[result.outcome.kind].body}</p>
              {result.hemolysis && <p><strong>{HEMOLYSIS_TEXT}</strong></p>}
              <p class="small muted">
                Blood sodium {result.outcome.naChange >= 0 ? 'rose' : 'fell'} by {Math.abs(result.outcome.naChange).toFixed(1)} mEq/L this round
                ({rise >= 0 ? '+' : ''}{rise.toFixed(1)} since the start of the trial). Skull pressure {result.outcome.icpChange >= 0 ? 'rose' : 'fell'} by {Math.abs(result.outcome.icpChange).toFixed(0)} mmHg.
              </p>
              <p><strong>Reassess:</strong> {stableNow
                ? 'Juniper is no longer seizing. Is it time to stop? More sodium now would only bring her closer to the day-one limit.'
                : `Juniper is still seizing. You have ${MAX_ROUNDS - trialLogs.length} round${MAX_ROUNDS - trialLogs.length === 1 ? '' : 's'} left in this trial.`}</p>
              <div class="row">
                <button class={stableNow ? 'secondary' : 'primary'} onClick={() => setResult(null)}>Give round {trialLogs.length + 1}</button>
                <button class={stableNow ? 'primary' : 'secondary'} onClick={endTrial}>End trial {s.trial} here</button>
              </div>
            </div>
          )}
          {showForm && (<>
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
            <small class={whyCheck.ok ? 'hint ok' : 'hint'}>
              {why.trim() ? (whyCheck.ok ? 'Ready.' : whyCheck.hint) : 'Explain your reasoning in a sentence.'}
            </small>
          </fieldset>
          <div class="row">
            <button class="primary" disabled={!canOrder} onClick={order}>💉 Start IV</button>
            {running && <button class="secondary" onClick={skip}>Skip to result</button>}
            {running && <span class="clock">Infusing and observing… {(live.timeMin / 60).toFixed(1)} h</span>}
          </div>
          {!running && !canOrder && (
            <p class="gate-hint">Still needed: {[!fluid && 'a fluid', !volume && 'an amount', !effect && 'a prediction', !whyCheck.ok && 'a reason for your prediction'].filter(Boolean).join(', ')}.</p>
          )}
          </>)}
        </section>
      </div>

      <div class="grid-sim">
        <section class="panel">
          <div class="charts">
            <LineChart title="Blood sodium" yLabel="mEq/L" yMin={100} yMax={145} xMax={xMax}
              series={[{ label: 'Na', points: series.na, cls: 'line-na' }]}
              bands={[
                { from: 134, to: 145, cls: 'band-ok', label: 'normal (days later)' },
                { from: shown.naAtTreatmentStart, to: shown.naAtTreatmentStart + MODEL.maxSafeRise24h, cls: 'band-safe', label: 'safe for day 1' },
              ]} />
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

      {s.treatments.length > 0 && (
        <section class="panel">
          <h3>Treatment log</h3>
          <div class="table-wrap">
            <table class="log">
              <thead><tr><th scope="col">Trial</th><th scope="col">Round</th><th scope="col">Fluid</th><th scope="col">Amount</th><th scope="col">You predicted</th><th scope="col">Na⁺ change</th><th scope="col">Result</th></tr></thead>
              <tbody>
                {s.treatments.map((t, i) => (
                  <tr key={i}>
                    <td>{t.trial}</td>
                    <td>{s.treatments.slice(0, i + 1).filter((u) => u.trial === t.trial).length}</td>
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

      {canMoveOn && (
        <section class="panel">
          <Prompt id={REFLECT_PROMPT.id} label={REFLECT_PROMPT.label} rows={4} tag="Check" />
          {!anySafe && <p class="muted small">You haven't stabilized Juniper safely yet. You can keep trying new trials, or move on.</p>}
          <button class="primary" disabled={!answered(REFLECT_PROMPT.id)} onClick={() => goTo(6)}>{ENABLE_RUNNER ? 'Try a new patient: the marathon runner →' : 'Finish and make my report →'}</button>
        </section>
      )}
    </div>
  );
}

function TrialScorecard({ r, onNew }: { r: TrialResult; onNew: () => void }) {
  const v = VERDICT_TEXT[r.summary.verdict];
  const item = (ok: boolean, text: string) => <li class={ok ? 'ok' : 'bad'}><span aria-hidden="true">{ok ? '✓' : '✗'}</span> {text}</li>;
  return (
    <div class={`scorecard verdict-${r.summary.verdict}`} role="status">
      <h4>Trial {r.trial}: {v.title}</h4>
      <ul class="checks">
        {item(r.summary.seizuresStopped, 'Seizures stopped')}
        {item(r.summary.riseOk, `Sodium rise in the first day: ${r.summary.rise >= 0 ? '+' : ''}${r.summary.rise.toFixed(1)} mEq/L (limit about +${MODEL.maxSafeRise24h})`)}
        {item(r.summary.noHarmfulFluid, 'No harmful fluid given')}
      </ul>
      <p>{v.body}</p>
      {r.endedBy === 'max_rounds' && <p class="small muted">This trial used all {MAX_ROUNDS} rounds (about one day).</p>}
      <button class="primary" onClick={onNew}>Start trial {r.trial + 1} with Juniper as she was at the start</button>
    </div>
  );
}
