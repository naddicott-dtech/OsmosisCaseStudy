import { useState } from 'preact/hooks';
import { cardById, evaluateChain, type ChainFeedback } from '../../chain';
import { CHAIN_EXPLAIN_LABEL, CHAIN_HELP_AFTER, CHAIN_HELP_TEXT } from '../../content/case';
import { saved, update, goTo } from '../../state';
import { Prompt, answered } from '../widgets';

// Fixed shuffled order so every student sees the same bank (and reloads stay stable).
const BANK_ORDER = ['c4', 'd2', 'c1', 'd5', 'c6', 'd1', 'c3', 'd4', 'c5', 'd3', 'c2'];
const byId = cardById;

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
              <li key={id} class={feedback?.flagged.includes(i) ? 'wrong' : ''}>
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
          {!s.chain.solved && s.chain.attempts >= CHAIN_HELP_AFTER && <p class="callout help" role="note">{CHAIN_HELP_TEXT}</p>}
        </section>
      </div>
      {s.chain.solved && (
        <section class="panel">
          <Prompt id="chain_explain" rows={4} tag="Check"
            label={CHAIN_EXPLAIN_LABEL} />
          <button class="primary" disabled={!answered('chain_explain')} onClick={() => goTo(5)}>Treat Juniper →</button>
        </section>
      )}
    </div>
  );
}
