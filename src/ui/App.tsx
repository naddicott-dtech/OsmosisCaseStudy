import { useEffect, useRef } from 'preact/hooks';
import { ENABLE_RUNNER, PATIENT } from '../content/case';
import { progressList } from '../report';
import { saved, update, goTo } from '../state';
import { About } from './About';
import { Brain } from './screens/Brain';
import { Chain } from './screens/Chain';
import { Exam } from './screens/Exam';
import { Intake } from './screens/Intake';
import { MiniLabs } from './screens/MiniLabs';
import { Report } from './screens/Report';
import { Runner } from './screens/Runner';
import { Treat } from './screens/Treat';

export const STEPS = ([
  { title: 'Intake', heading: 'Intake: meet your patient', C: Intake },
  { title: 'Exam & Labs', heading: 'Exam and lab results', C: Exam },
  { title: 'Inside the Brain', heading: 'Inside the brain', C: Brain },
  { title: 'Mini-labs', heading: 'Mini-labs: how membranes handle water', C: MiniLabs },
  { title: 'Causal Chain', heading: 'Build the causal chain', C: Chain },
  { title: 'Treatment', heading: 'Treat Juniper', C: Treat },
  { title: 'Runner Case', heading: 'Transfer: the marathon runner', C: Runner },
  { title: 'Report', heading: 'Your report', C: Report },
]).filter((st) => ENABLE_RUNNER || st.C !== Runner);

export function App() {
  const s = saved.value;
  const stepIdx = Math.max(0, Math.min(STEPS.length - 1, s.step));
  const step = STEPS[stepIdx];
  const done = progressList(s).map((p) => p.done);
  const aboutRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', s.reduceMotion);
  }, [s.reduceMotion]);

  useEffect(() => {
    document.querySelector('.stepper button.current')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [stepIdx]);

  useEffect(() => {
    document.title = `${step.title} · Osmosis Case Study`;
  }, [step.title]);

  return (
    <div class="app">
      <a class="skip" href="#main">Skip to activity</a>
      <header class="topbar">
        <div class="brand">
          <h1>Osmosis Case Study</h1>
          <p>Dr. You · Patient: {PATIENT.name} ({PATIENT.description})</p>
        </div>
        <div class="settings">
          <label class="toggle">
            <input type="checkbox" checked={s.reduceMotion}
              onChange={(e) => update(() => ({ reduceMotion: (e.target as HTMLInputElement).checked }))} />
            Reduce motion
          </label>
          <button class="ghost" onClick={() => aboutRef.current?.showModal()}>About & model notes</button>
        </div>
      </header>
      <nav class="stepper" aria-label="Case steps">
        <ol>
          {STEPS.map((st, i) => (
            <li key={st.title}>
              <button class={`${i === stepIdx ? 'current' : ''} ${done[i] ? 'done' : ''}`}
                aria-current={i === stepIdx ? 'step' : undefined} onClick={() => goTo(i)}>
                <span class="num" aria-hidden="true">{done[i] ? '✓' : i + 1}</span>
                <span class="lbl">{st.title}</span>
                {done[i] && <span class="sr-only"> (complete)</span>}
              </button>
            </li>
          ))}
        </ol>
      </nav>
      <main id="main">
        <h2 id="main-heading" tabIndex={-1}>{step.heading}</h2>
        <step.C key={stepIdx} />
        <div class="pager no-print">
          <button class="ghost" disabled={stepIdx === 0} onClick={() => goTo(stepIdx - 1)}>← Back</button>
          <span class="muted small">Step {stepIdx + 1} of {STEPS.length}. Progress saves automatically on this device.</span>
          <button class="ghost" disabled={stepIdx === STEPS.length - 1} onClick={() => goTo(stepIdx + 1)}>Next →</button>
        </div>
      </main>
      <About dialogRef={aboutRef} />
    </div>
  );
}
