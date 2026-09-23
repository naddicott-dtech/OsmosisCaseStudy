import { useState } from 'preact/hooks';
import { CHAIN_CARDS, type ChainCard } from '../../content/case';
import { saved, update, goTo } from '../../state';
import { Prompt, answered } from '../widgets';

// Fixed shuffled order so every student sees the same bank (and reloads stay stable).
const BANK_ORDER = ['c4', 'd2', 'c1', 'c6', 'd1', 'c3', 'd4', 'c5', 'd3', 'c2'];
const byId = (id: string) => CHAIN_CARDS.find((c) => c.id === id) as ChainCard;
const CORRECT = CHAIN_CARDS.filter((c) => c.order >= 0).sort((a, b) => a.order - b.order).map((c) => c.id);

export interface ChainFeedback {
  ok: boolean;
  messages: string[];
  wrongIndex: number | null;
}

export function evaluateChain(chain: string[]): ChainFeedback {
  const distractors = chain.map(byId).filter((c) => c.order < 0);
  if (distractors.length) {
    return { ok: false, messages: distractors.map((d) => `“${d.text}” — ${d.misconception}`), wrongIndex: null };
  }
  const missing = CORRECT.length - chain.length;
  for (let i = 0; i < chain.length; i++) {
    if (chain[i] !== CORRECT[i]) {
      return {
        ok: false,
        messages: [`Link ${i + 1} is out of order. Ask yourself: does it directly cause the next link? What has to happen first?`],
        wrongIndex: i,
      };
    }
  }
  if (missing > 0) {
    return { ok: false, messages: [`So far so good, but your chain is missing ${missing} link${missing > 1 ? 's' : ''}. What happens next?`], wrongIndex: null };
  }
  return { ok: true, messages: ['Your chain is complete and in order. Every link causes the next one.'], wrongIndex: null };
}

export function Chain() {
  const s = saved.value;
  const chain = s.chain.current;
  const [feedback, setFeedback] = useState<ChainFeedback | null>(s.chain.solved ? evaluateChain(chain) : null);
  const setChain = (next: string[]) => {
    setFeedback(null);
    update((st) => ({ chain: { ...st.chain, current: next } }));
  };
  const move = (i: number, d: -1 | 1) => {
    const next = [...chain];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setChain(next);
    requestAnimationFrame(() => document.getElementById(`chain-${i + d}-${d < 0 ? 'up' : 'down'}`)?.focus());
  };
  const check = () => {
    const fb = evaluateChain(chain);
    setFeedback(fb);
    update((st) => ({
      chain: {
        ...st.chain,
        attempts: st.chain.attempts + 1,
        firstAttempt: st.chain.firstAttempt ?? [...chain],
        solved: st.chain.solved || fb.ok,
      },
    }));
  };

  return (
    <div class="stack">
      <section class="panel">
        <p>
          Build the chain of cause and effect from Juniper's diarrhea to her seizures. Click a card to add it to the end of
          your chain. Use ↑ ↓ to reorder and ✕ to remove. <strong>Some cards are wrong and don't belong in the chain.</strong>
        </p>
      </section>
      <div class="grid2">
        <section class="panel">
          <h3>Card bank</h3>
          <ul class="bank">
            {BANK_ORDER.filter((id) => !chain.includes(id)).map((id) => (
              <li key={id}>
                <button class="card" onClick={() => setChain([...chain, id])}>{byId(id).text}</button>
              </li>
            ))}
          </ul>
        </section>
        <section class="panel">
          <h3>Your chain</h3>
          {chain.length === 0 && <p class="muted">Empty. Click cards in the bank to add them.</p>}
          <ol class="chain">
            {chain.map((id, i) => (
              <li key={id} class={feedback?.wrongIndex === i ? 'wrong' : ''}>
                <span class="chain-text">{byId(id).text}</span>
                <span class="chain-actions">
                  <button id={`chain-${i}-up`} aria-label={`Move link ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                  <button id={`chain-${i}-down`} aria-label={`Move link ${i + 1} down`} disabled={i === chain.length - 1} onClick={() => move(i, 1)}>↓</button>
                  <button aria-label={`Remove link ${i + 1}`} onClick={() => setChain(chain.filter((c) => c !== id))}>✕</button>
                </span>
              </li>
            ))}
          </ol>
          <div class="row">
            <button class="primary" disabled={chain.length === 0} onClick={check}>Check my chain</button>
            <span class="muted small">Attempts: {s.chain.attempts}</span>
          </div>
          {feedback && (
            <div class={feedback.ok ? 'callout good' : 'callout warn'} role="status">
              {feedback.messages.map((m) => <p key={m}>{m}</p>)}
            </div>
          )}
        </section>
      </div>
      {s.chain.solved && (
        <section class="panel">
          <Prompt id="chain_explain" minChars={40} rows={4} tag="Check"
            label="Pick the ONE link in the chain that you think is most important for explaining the seizures. Explain it in your own words, as if to the farmer." />
          <button class="primary" disabled={!answered('chain_explain', 40)} onClick={() => goTo(5)}>Treat Juniper →</button>
        </section>
      )}
    </div>
  );
}
