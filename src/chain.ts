import { CHAIN_CARDS, type ChainCard } from './content/case';

export const cardById = (id: string) => CHAIN_CARDS.find((c) => c.id === id) as ChainCard;
export const CORRECT_CHAIN = CHAIN_CARDS.filter((c) => c.order >= 0).sort((a, b) => a.order - b.order).map((c) => c.id);

export interface ChainFeedback {
  ok: boolean;
  messages: string[];
  /** Chain positions to highlight (0-based). */
  flagged: number[];
}

/**
 * Judge a student's chain by RELATIVE order: a correct chain with a link missing
 * is reported as missing a link (and where), not as "out of order".
 */
export function evaluateChain(chain: string[]): ChainFeedback {
  const cards = chain.map(cardById);
  if (!cards.length) return { ok: false, messages: ['Add cards from the bank to build your chain.'], flagged: [] };
  const distractorIdx = cards.map((c, i) => (c.order < 0 ? i : -1)).filter((i) => i >= 0);
  if (distractorIdx.length) {
    return {
      ok: false,
      messages: distractorIdx.map((i) => `Link ${i + 1}, “${cards[i].text}”: ${cards[i].misconception}`),
      flagged: distractorIdx,
    };
  }

  for (let i = 0; i + 1 < cards.length; i++) {
    if (cards[i].order > cards[i + 1].order) {
      return {
        ok: false,
        messages: [`Links ${i + 1} and ${i + 2} are in the wrong order. Which one causes the other?`],
        flagged: [i, i + 1],
      };
    }
  }

  const messages: string[] = [];
  const flagged: number[] = [];
  if (cards.length && cards[0].order > 0) {
    messages.push('Something happens before your first link. What started all of this?');
    flagged.push(0);
  }
  for (let i = 0; i + 1 < cards.length; i++) {
    const gap = cards[i + 1].order - cards[i].order - 1;
    if (gap > 0) {
      messages.push(`Links ${i + 1} and ${i + 2} are in the right order, but ${gap === 1 ? 'a step is' : `${gap} steps are`} missing between them. How does one lead to the other?`);
      flagged.push(i, i + 1);
    }
  }
  const last = cards.at(-1);
  if (last && last.order < CORRECT_CHAIN.length - 1) {
    messages.push('Your chain stops early. What happens next, all the way to the seizures?');
    flagged.push(cards.length - 1);
  }
  if (messages.length) return { ok: false, messages: ['Everything you have is in the right order.', ...messages], flagged };
  return { ok: true, messages: ['Your chain is complete and in order. Every link causes the next one.'], flagged: [] };
}
