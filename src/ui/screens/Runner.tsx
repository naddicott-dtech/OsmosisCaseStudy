import { RUNNER } from '../../content/case';
import { saved, update, goTo } from '../../state';
import { FlagPicker, Prompt, answered } from '../widgets';

const flagOf = (l: { value: number; low: number; high: number }) => (l.value < l.low ? 'low' : l.value > l.high ? 'high' : 'normal');

export function Runner() {
  const s = saved.value;
  const allFlagged = RUNNER.labs.every((l) => s.runnerFlags[l.id]);
  const checked = s.runnerCheck.attempts > 0;
  const nCorrect = RUNNER.labs.filter((l) => s.runnerFlags[l.id] === flagOf(l)).length;
  const choice = s.runnerChoice.current;
  const choiceObj = RUNNER.treatmentChoice.choices.find((c) => c.id === choice);
  const missingWritten = RUNNER.questions.filter((q) => !answered(q.id)).length;
  const writtenDone = missingWritten === 0;

  const check = () =>
    update((st) => ({
      runnerCheck: {
        attempts: st.runnerCheck.attempts + 1,
        firstScore: st.runnerCheck.firstScore ?? `${nCorrect}/${RUNNER.labs.length}`,
        done: nCorrect === RUNNER.labs.length,
      },
    }));

  return (
    <div class="stack">
      <section class="panel">
        <p class="role">New patient: a human this time. No simulation help. Use what you learned from Juniper.</p>
        <p>{RUNNER.intro}</p>
        <div class="table-wrap">
          <table class="labs">
            <thead><tr><th scope="col">Measurement</th><th scope="col">Runner</th><th scope="col">Normal range</th><th scope="col">Your flag</th></tr></thead>
            <tbody>
              {RUNNER.labs.map((l) => (
                <tr key={l.id}>
                  <th scope="row">{l.name}</th>
                  <td data-label="Runner" class="num">{l.id === 'r_mass' && l.value > 0 ? '+' : ''}{l.value} <small>{l.unit}</small></td>
                  <td data-label="Normal range" class="num">{l.id === 'r_mass' ? 'lose 0–3 kg' : `${l.low}–${l.high}`} <small>{l.id === 'r_mass' ? '' : l.unit}</small></td>
                  <td data-label="Your flag">
                    <FlagPicker id={`run-${l.id}`} label={l.name} value={s.runnerFlags[l.id]}
                      correct={checked && s.runnerFlags[l.id] ? s.runnerFlags[l.id] === flagOf(l) : null}
                      onChange={(v) => update((st) => ({ runnerFlags: { ...st.runnerFlags, [l.id]: v } }))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p class="muted small">Runners usually <em>lose</em> some weight during a marathon from sweating. Gaining weight means they took in more water than they lost.</p>
        <div class="row">
          <button class="secondary" disabled={!allFlagged} onClick={check}>Check my flags</button>
          {checked && (
            <span aria-live="polite" class={nCorrect === RUNNER.labs.length ? 'good' : 'warn'}>
              {nCorrect === RUNNER.labs.length ? 'All flags correct.' : `${nCorrect} of ${RUNNER.labs.length} correct. Look at the ✗ rows again.`}
            </span>
          )}
        </div>
      </section>

      <section class="panel">
        <h3><span class="purpose purpose-check">Check</span> Explain the runner's collapse</h3>
        {RUNNER.questions.map((q) => <Prompt key={q.id} id={q.id} label={q.label} rows={4} />)}
      </section>

      <section class="panel">
        <fieldset class="mc">
          <legend>{RUNNER.treatmentChoice.question}</legend>
          {RUNNER.treatmentChoice.choices.map((c) => (
            <label key={c.id} class={`radio ${choice === c.id ? 'on' : ''}`}>
              <input type="radio" name="runner-tx" checked={choice === c.id}
                onChange={() => update((st) => ({ runnerChoice: { first: st.runnerChoice.first ?? c.id, current: c.id } }))} />
              <span>{c.text}</span>
            </label>
          ))}
        </fieldset>
        {choiceObj && (
          <p class={`callout ${choice === RUNNER.treatmentChoice.best ? 'good' : 'warn'}`} role="status">{choiceObj.feedback}</p>
        )}
        <button class="primary" disabled={!writtenDone || !choice} onClick={() => goTo(7)}>Finish and make my report →</button>
        {(!writtenDone || !choice) && (
          <p class="gate-hint">Still needed: {[
            missingWritten > 0 && `${missingWritten} written answer${missingWritten === 1 ? '' : 's'}`,
            !choice && 'a treatment choice',
          ].filter(Boolean).join(', ')}.</p>
        )}
      </section>
    </div>
  );
}
