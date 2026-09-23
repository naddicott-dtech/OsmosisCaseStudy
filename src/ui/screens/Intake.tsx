import { HISTORY, INTAKE_PROMPT, PATIENT } from '../../content/case';
import { createPatient } from '../../engine/physiology';
import { saved, goTo } from '../../state';
import { Calf } from '../Calf';
import { Prompt, answered } from '../widgets';

export function Intake() {
  const s = saved.value;
  return (
    <div class="grid2">
      <section class="panel visual">
        <Calf status={createPatient().status} reduceMotion={s.reduceMotion} />
      </section>
      <section class="panel">
        <p class="role">You are the veterinarian on call.</p>
        <h3>Patient: {PATIENT.name}</h3>
        <p class="muted">{PATIENT.description}</p>
        <h4>What the farmer tells you</h4>
        <ul class="history">
          {HISTORY.map((h) => <li key={h}>{h}</li>)}
        </ul>
        <Prompt id="intake_hypothesis" label={INTAKE_PROMPT} minChars={25} rows={4} tag="Engage" />
        <p class="muted small">There's no wrong answer yet. You'll come back to your first idea at the end.</p>
        <button class="primary" disabled={!answered('intake_hypothesis', 25)} onClick={() => goTo(1)}>
          Examine {PATIENT.name} →
        </button>
      </section>
    </div>
  );
}
