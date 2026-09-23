import { EXAM_TOOLS, LABS, LAB_PROMPTS, labFlag } from '../../content/case';
import { createPatient } from '../../engine/physiology';
import { saved, update, goTo } from '../../state';
import { Calf } from '../Calf';
import { FlagPicker, Prompt, answered } from '../widgets';

export function Exam() {
  const s = saved.value;
  const bloodDrawn = s.toolsUsed.includes('blood');
  const allFlagged = LABS.every((l) => s.labFlags[l.id]);
  const checked = s.labCheck.attempts > 0;
  const nCorrect = LABS.filter((l) => s.labFlags[l.id] === labFlag(l)).length;

  const useTool = (id: string) =>
    update((st) => ({ toolsUsed: st.toolsUsed.includes(id) ? st.toolsUsed : [...st.toolsUsed, id] }));

  const check = () =>
    update((st) => {
      const score = `${nCorrect}/${LABS.length}`;
      return {
        labCheck: {
          attempts: st.labCheck.attempts + 1,
          firstScore: st.labCheck.firstScore ?? score,
          done: nCorrect === LABS.length,
        },
      };
    });

  return (
    <div class="stack">
      <div class="grid2">
        <section class="panel visual">
          <Calf status={createPatient().status} reduceMotion={s.reduceMotion} />
        </section>
        <section class="panel">
          <h3>Physical exam</h3>
          <p class="muted">Use each tool. Findings are added to the chart.</p>
          <div class="tools">
            {EXAM_TOOLS.map((t) => (
              <button key={t.id} class={`tool ${s.toolsUsed.includes(t.id) ? 'used' : ''}`} onClick={() => useTool(t.id)}
                aria-pressed={s.toolsUsed.includes(t.id)}>
                <span class="tool-icon" aria-hidden="true">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
          <ul class="findings" aria-live="polite">
            {EXAM_TOOLS.filter((t) => s.toolsUsed.includes(t.id)).map((t) => (
              <li key={t.id}><strong>{t.label}:</strong> {t.finding}</li>
            ))}
          </ul>
        </section>
      </div>

      {bloodDrawn && (
        <section class="panel">
          <h3>Lab report: blood chemistry</h3>
          <p class="muted">
            Compare each value to its reference range. Flag it <strong>Low</strong>, <strong>Normal</strong>, or <strong>High</strong>.
            (Ranges are for cattle. Young calves can differ slightly.)
          </p>
          <div class="table-wrap">
            <table class="labs">
              <thead>
                <tr><th scope="col">Test</th><th scope="col">Juniper</th><th scope="col">Reference range</th><th scope="col">Your flag</th></tr>
              </thead>
              <tbody>
                {LABS.map((l) => {
                  const mine = s.labFlags[l.id];
                  return (
                    <tr key={l.id}>
                      <th scope="row">{l.name}<br /><small>{l.plain}</small></th>
                      <td data-label="Juniper" class="num">{l.value} <small>{l.unit}</small></td>
                      <td data-label="Reference range" class="num">{l.low}–{l.high} <small>{l.unit}</small></td>
                      <td data-label="Your flag">
                        <FlagPicker id={`lab-${l.id}`} label={l.name} value={mine}
                          correct={checked && mine ? mine === labFlag(l) : null}
                          onChange={(v) => update((st) => ({ labFlags: { ...st.labFlags, [l.id]: v } }))} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div class="row">
            <button class="secondary" disabled={!allFlagged} onClick={check}>Check my flags</button>
            {checked && (
              <span aria-live="polite" class={nCorrect === LABS.length ? 'good' : 'warn'}>
                {nCorrect === LABS.length
                  ? 'All flags correct.'
                  : `${nCorrect} of ${LABS.length} correct. Look again at the ✗ rows: is the value below the low end, inside the range, or above the high end?`}
              </span>
            )}
          </div>
        </section>
      )}

      {s.labCheck.done && (
        <section class="panel">
          <h3>Interpret the evidence</h3>
          {LAB_PROMPTS.map((p) => <Prompt key={p.id} id={p.id} label={p.label} minChars={25} tag="Practice" />)}
          <button class="primary" disabled={!LAB_PROMPTS.every((p) => answered(p.id, 25))} onClick={() => goTo(2)}>
            Look inside the brain →
          </button>
        </section>
      )}
    </div>
  );
}
