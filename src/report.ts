import {
  BRAIN_EXPLAIN, BRAIN_PREDICTION, CHAIN_CARDS, CHAIN_EXPLAIN_LABEL, INTAKE_PROMPT, LAB_PROMPTS, LABS, MINILAB_PROMPTS, OUTCOME_TEXT, PSI_PROMPTS,
  ENABLE_RUNNER, REFLECT_PROMPT, RUNNER,
} from './content/case';
import { FLUIDS } from './engine/physiology';
import { VERDICT_TEXT } from './content/case';
import type { Saved } from './state';
import { assessAnswer, RULES } from './quality';

const cardText = (id: string) => CHAIN_CARDS.find((c) => c.id === id)?.text ?? id;
const psiChoice = (id: string | undefined) => PSI_PROMPTS.dir.choices.find((c) => c.id === id)?.text;

/** Honors water potential is done: both calculations and a direction, or the retired single answer. */
export function psiComplete(s: Saved, ok: (id: string) => boolean): boolean {
  return (ok(PSI_PROMPTS.blood.id) && ok(PSI_PROMPTS.cell.id) && !!s.answers[PSI_PROMPTS.dir.id]) || ok(MINILAB_PROMPTS.psi.id);
}

export interface ReportSection {
  title: string;
  lines: string[];
}

/** Build the student's report. Plain text, so it pastes cleanly into Canvas. */
export function buildReport(s: Saved): ReportSection[] {
  const a = (id: string) => (s.answers[id]?.trim() ? s.answers[id].trim() : '(no answer)');
  const sections: ReportSection[] = [];

  sections.push({
    title: '1. Intake: first hypothesis',
    lines: [`Q: ${INTAKE_PROMPT}`, `A: ${a('intake_hypothesis')}`],
  });

  sections.push({
    title: '2. Exam & labs',
    lines: [
      `Exam tools used: ${s.toolsUsed.length ? s.toolsUsed.join(', ') : 'none'}`,
      `Lab flags first check: ${s.labCheck.firstScore ?? 'not checked'} (checks: ${s.labCheck.attempts})`,
      `Abnormal values flagged: ${LABS.filter((l) => s.labFlags[l.id] && s.labFlags[l.id] !== 'normal').map((l) => `${l.name} ${s.labFlags[l.id]}`).join('; ') || 'none'}`,
      ...LAB_PROMPTS.flatMap((p) => [`Q: ${p.label}`, `A: ${a(p.id)}`]),
    ],
  });

  const pred = BRAIN_PREDICTION.choices.find((c) => c.id === s.brainPrediction);
  sections.push({
    title: '3. Inside the brain',
    lines: [
      `Prediction: ${pred ? `${pred.text}${pred.correct ? ' (matched the model)' : ' (did not match the model)'}` : '(none)'}`,
      `Q: ${BRAIN_EXPLAIN.label}`,
      `A: ${a(BRAIN_EXPLAIN.id)}`,
    ],
  });

  const seen = Object.entries(s.cellSeen).filter(([, v]) => v).map(([k]) => k);
  sections.push({
    title: '4. Mini-labs',
    lines: [
      `Q: ${MINILAB_PROMPTS.membrane.label}`, `A: ${a(MINILAB_PROMPTS.membrane.id)}`,
      `Solutions observed in the cell lab: ${seen.join(', ') || 'none'}`,
      `Q: ${MINILAB_PROMPTS.cell.label}`, `A: ${a(MINILAB_PROMPTS.cell.id)}`,
      ...psiLines(s, a),
    ],
  });

  sections.push({
    title: '5. Causal chain',
    lines: [
      `Solved: ${s.chain.solved ? 'yes' : 'no'} (checks: ${s.chain.attempts})`,
      'First attempt:',
      ...(s.chain.firstAttempt?.length ? s.chain.firstAttempt.map((id, i) => `  ${i + 1}. ${cardText(id)}`) : ['  (none)']),
      // Always print the final chain: students refer to links by number in their explanation.
      `${s.chain.solved ? 'Final (solved) chain' : 'Current chain'}:`,
      ...(s.chain.current.length ? s.chain.current.map((id, i) => `  ${i + 1}. ${cardText(id)}`) : ['  (none)']),
      `Q: ${CHAIN_EXPLAIN_LABEL}`,
      `A: ${a('chain_explain')}`,
    ],
  });

  sections.push({
    title: '6. Treatment',
    lines: [
      ...(s.treatments.length
        ? s.treatments.map((t, i) =>
            `Trial ${t.trial}, order ${i + 1}: ${FLUIDS[t.fluid].short}, ${t.volumeL} L. Predicted: ${t.predictedEffect === 'in' ? 'water into brain' : t.predictedEffect === 'out' ? 'water out of brain' : 'little change'}. Reason: "${t.prediction}". Result: ${OUTCOME_TEXT[t.outcome].title} (Na ${t.naBefore.toFixed(1)} → ${t.naAfter.toFixed(1)}).`)
        : ['(no treatments given)']),
      ...s.trialResults.map((r) => `Trial ${r.trial} result (${r.rounds} round${r.rounds === 1 ? '' : 's'}): ${VERDICT_TEXT[r.summary.verdict].title}. Seizures stopped: ${r.summary.seizuresStopped ? 'yes' : 'no'}; first-day sodium rise ${r.summary.rise >= 0 ? '+' : ''}${r.summary.rise.toFixed(1)} mEq/L.`),
      `Q: ${REFLECT_PROMPT.label}`,
      `A: ${a(REFLECT_PROMPT.id)}`,
    ],
  });

  if (!ENABLE_RUNNER) return sections;
  const firstChoice = RUNNER.treatmentChoice.choices.find((c) => c.id === s.runnerChoice.first);
  const finalChoice = RUNNER.treatmentChoice.choices.find((c) => c.id === s.runnerChoice.current);
  sections.push({
    title: '7. Runner case (Check)',
    lines: [
      `Data flags first check: ${s.runnerCheck.firstScore ?? 'not checked'}`,
      ...RUNNER.questions.flatMap((q) => [`Q: ${q.label}`, `A: ${a(q.id)}`]),
      `Treatment choice (first): ${firstChoice?.text ?? '(none)'}`,
      ...(finalChoice && finalChoice.id !== firstChoice?.id ? [`Treatment choice (final): ${finalChoice.text}`] : []),
    ],
  });

  return sections;
}

export function reportText(s: Saved): string {
  const head = [
    'OSMOSIS CASE STUDY: Juniper the calf',
    `Started: ${new Date(s.startedAt).toLocaleString()}   Report made: ${new Date().toLocaleString()}${s.honors ? '   (Honors)' : ''}`,
    '',
  ];
  return [...head, ...buildReport(s).flatMap((sec) => [sec.title.toUpperCase(), ...sec.lines, ''])].join('\n');
}

function psiLines(s: Saved, a: (id: string) => string): string[] {
  const tag = s.honors ? 'Honors' : 'Optional';
  const legacy = s.answers[MINILAB_PROMPTS.psi.id]?.trim();
  const started = [PSI_PROMPTS.blood.id, PSI_PROMPTS.cell.id, PSI_PROMPTS.dir.id].some((id) => s.answers[id]?.trim());
  if (!s.honors && !legacy && !started) return [];
  const dir = s.answers[PSI_PROMPTS.dir.id];
  const first = s.answers[PSI_PROMPTS.dir.firstId];
  const lines = legacy ? [`${tag} Q: ${MINILAB_PROMPTS.psi.label}`, `A: ${legacy}`] : [];
  if (started || !legacy) {
    lines.push(
      `${tag} Q: ${PSI_PROMPTS.blood.label}`, `A: ${a(PSI_PROMPTS.blood.id)}`,
      `${tag} Q: ${PSI_PROMPTS.cell.label}`, `A: ${a(PSI_PROMPTS.cell.id)}`,
      `${tag} Q: ${PSI_PROMPTS.dir.label}`,
      `A: ${psiChoice(dir) ?? '(no answer)'}${dir ? (dir === PSI_PROMPTS.dir.correct ? ' (correct)' : ' (not correct)') : ''}` +
        (first && first !== dir ? `. First choice: ${psiChoice(first)}` : ''),
    );
  }
  return lines;
}

export interface Progress {
  label: string;
  done: boolean;
}

export function progressList(s: Saved): Progress[] {
  const has = (id: string) => assessAnswer(s.answers[id] ?? '', RULES[id]).ok;
  return [
    { label: 'Intake hypothesis', done: has('intake_hypothesis') },
    { label: 'Lab flags and interpretation', done: s.labCheck.done && LAB_PROMPTS.every((p) => has(p.id)) },
    { label: 'Brain simulation and explanation', done: s.brainWatched && has(BRAIN_EXPLAIN.id) },
    { label: s.honors ? 'Mini-labs 1, 2 & 3 (Honors)' : 'Mini-labs 1 & 2', done: has(MINILAB_PROMPTS.membrane.id) && has(MINILAB_PROMPTS.cell.id) && (!s.honors || psiComplete(s, has)) },
    { label: 'Causal chain', done: s.chain.solved && has('chain_explain') },
    { label: 'Treatment trials and reflection', done: (s.trialResults.some((r) => r.summary.verdict === 'safe') || s.trialResults.length >= 3) && has(REFLECT_PROMPT.id) },
    ...(ENABLE_RUNNER ? [{ label: 'Runner case', done: RUNNER.questions.every((q) => has(q.id)) && !!s.runnerChoice.current }] : []),
  ];
}
