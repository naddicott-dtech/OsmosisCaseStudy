import {
  BRAIN_EXPLAIN, BRAIN_PREDICTION, CHAIN_CARDS, INTAKE_PROMPT, LAB_PROMPTS, LABS, MINILAB_PROMPTS, OUTCOME_TEXT,
  ENABLE_RUNNER, REFLECT_PROMPT, RUNNER,
} from './content/case';
import { FLUIDS } from './engine/physiology';
import { VERDICT_TEXT } from './content/case';
import type { Saved } from './state';
import { assessAnswer, RULES } from './quality';

const cardText = (id: string) => CHAIN_CARDS.find((c) => c.id === id)?.text ?? id;

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
      ...(s.honors || s.answers[MINILAB_PROMPTS.psi.id]?.trim() ? [`${s.honors ? 'Honors' : 'Optional'} Q: ${MINILAB_PROMPTS.psi.label}`, `A: ${a(MINILAB_PROMPTS.psi.id)}`] : []),
    ],
  });

  sections.push({
    title: '5. Causal chain',
    lines: [
      `Solved: ${s.chain.solved ? 'yes' : 'no'} (checks: ${s.chain.attempts})`,
      'First attempt:',
      ...(s.chain.firstAttempt?.length ? s.chain.firstAttempt.map((id, i) => `  ${i + 1}. ${cardText(id)}`) : ['  (none)']),
      ...(s.chain.solved ? [] : ['Current chain:', ...s.chain.current.map((id, i) => `  ${i + 1}. ${cardText(id)}`)]),
      'Q: Explain the most important link in your own words.',
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
    { label: s.honors ? 'Mini-labs 1, 2 & 3 (Honors)' : 'Mini-labs 1 & 2', done: has(MINILAB_PROMPTS.membrane.id) && has(MINILAB_PROMPTS.cell.id) && (!s.honors || has(MINILAB_PROMPTS.psi.id)) },
    { label: 'Causal chain', done: s.chain.solved && has('chain_explain') },
    { label: 'Treatment trials and reflection', done: (s.trialResults.some((r) => r.summary.verdict === 'safe') || s.trialResults.length >= 3) && has(REFLECT_PROMPT.id) },
    ...(ENABLE_RUNNER ? [{ label: 'Runner case', done: RUNNER.questions.every((q) => has(q.id)) && !!s.runnerChoice.current }] : []),
  ];
}
