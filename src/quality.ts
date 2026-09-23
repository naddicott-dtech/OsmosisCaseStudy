// Local "did some thinking happen?" check for written answers. Runs entirely in the browser.
// It is a speed bump against filler (aaaaaa, keyboard mash, copy-pasted question words), not a grader.
// A determined student can still write fluent nonsense; a model-based check is planned for a later
// hosted edition. Keep messages encouraging and specific.

export interface QualityOptions {
  /** Minimum number of real words. */
  minWords?: number;
  /** At least one of these (case-insensitive substrings) should appear. */
  keywords?: string[];
  /** Words from the question itself (copied back verbatim doesn't count as thinking). */
  prompt?: string;
}

export interface QualityResult {
  ok: boolean;
  /** Short, student-facing hint for the first problem found. */
  hint: string;
  words: number;
}

const COMMON = new Set(
  ('a an the and or but so because since if then than that this these those it its is are was were be been being ' +
    'to of in on at by for from with into out up down as not no more less most least very can could would should ' +
    'will may might do does did has have had i we they she he her his their them you my our which what when why how ' +
    'there here also all some any each other both same different makes make causes cause lead leads means')
    .split(' '),
);

const VOWEL = /[aeiouy]/i;

/** A token that plausibly is a word (not "asdfgh" or "zzzzz"). */
export function looksLikeWord(w: string): boolean {
  const t = w.toLowerCase().replace(/[^a-z'⁺⁻0-9]/g, '');
  if (!t) return false;
  if (/^\d+(\.\d+)?$/.test(t)) return true; // numbers count (e.g. "110")
  if (t.length > 22) return false;
  if (/(.)\1\1/.test(t)) return false; // 3+ identical letters in a row
  if (t.length >= 3 && !VOWEL.test(t)) return false; // no vowels: "sdfgh"
  if (/[bcdfghjklmnpqrstvwxz]{5,}/.test(t)) return false; // consonant pile-up
  return true;
}

/** Keywords of 3 or fewer letters must be whole words ("na" shouldn't match "final"); longer ones match as stems. */
export function hasKeyword(lowerText: string, keyword: string): boolean {
  const k = keyword.toLowerCase();
  if (k.length <= 3) return new RegExp(`(^|[^a-z])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(lowerText);
  return lowerText.includes(k);
}

export function tokenize(text: string): string[] {
  return text.split(/[\s,.;:!?()"“”/]+/).filter(Boolean);
}

export function assessAnswer(text: string, opts: QualityOptions = {}): QualityResult {
  const target = opts.minWords ?? 8;
  const floor = Math.min(6, target);
  const tokens = tokenize(text);
  const words = tokens.filter(looksLikeWord);
  const lower = text.toLowerCase();
  const fail = (hint: string): QualityResult => ({ ok: false, hint, words: words.length });
  const pass = (hint: string): QualityResult => ({ ok: true, hint, words: words.length });

  // Hard blocks: only obvious filler. Err on the side of accepting real (if short) answers.
  if (words.length < floor) return fail(`Write a bit more: at least ${floor} real words (you have ${words.length}).`);
  if (words.length < tokens.length * 0.6) return fail('Some of this doesn’t look like real words. Write it out in sentences.');
  const unique = new Set(words.map((w) => w.toLowerCase()));
  if (unique.size < Math.max(4, words.length * 0.4)) return fail('Lots of repeated words. Explain your idea instead of repeating it.');

  // Soft tips: shown, but they do not block.
  if (opts.prompt) {
    const promptWords = new Set(tokenize(opts.prompt.toLowerCase()));
    const fresh = words.filter((w) => !promptWords.has(w.toLowerCase()) && !COMMON.has(w.toLowerCase()));
    if (fresh.length < 2) return fail('This mostly repeats the question. Add your own explanation.');
  }
  if (opts.keywords?.length && !opts.keywords.some((k) => hasKeyword(lower, k))) {
    return pass(`Saved ✓ Tip: can you connect this to a science idea (for example: ${opts.keywords.slice(0, 4).join(', ')})?`);
  }
  if (words.length < target) return pass('Saved ✓ Tip: a little more detail would make your reasoning clearer.');
  return pass('Saved on this device ✓');
}

// Topic vocabularies used by prompts.
export const VOCAB = {
  water: ['water', 'h2o', 'h₂o', 'osmosis', 'hydrat', 'fluid', 'drink'],
  osmosis: ['osmosis', 'water', 'solute', 'concentrat', 'sodium', 'salt', 'na', 'aquaporin', 'membrane', 'tonic', 'dilut'],
  evidence: ['temperature', 'temp', 'sodium', 'na', 'potassium', 'chloride', 'glucose', 'sugar', 'bun', 'kidney', 'pcv', 'heart', 'breath', 'osmol', 'bicarbonate', 'ph', 'range', 'normal', 'low', 'high', 'fever', 'dehydrat', 'pupil', 'head', 'skin', 'lab', 'blood'],
  treatment: ['saline', 'salt', 'sodium', 'hypertonic', 'hypotonic', 'isotonic', 'water', 'osmosis', 'concentrat', 'fluid', 'd5w', 'swell', 'brain', 'pressure'],
  runner: ['sodium', 'hypotonic', 'osmosis', 'water', 'brain', 'swell', 'dilut', 'drank', 'drink', 'weight', 'temperature', 'glucose', 'sugar'],
};

/** Rules for every written prompt, by answer id. */
export const RULES: Record<string, QualityOptions> = {
  intake_hypothesis: { minWords: 12 },
  labs_systems: { minWords: 10, keywords: VOCAB.evidence },
  labs_link: { minWords: 10, keywords: VOCAB.evidence },
  brain_explain: { minWords: 15, keywords: VOCAB.osmosis },
  lab_membrane: { minWords: 15, keywords: VOCAB.osmosis },
  lab_cell: { minWords: 15, keywords: ['hypotonic', 'isotonic', 'hypertonic', 'swell', 'shrink', 'burst', 'lys', 'water'] },
  lab_psi: { minWords: 12, keywords: ['potential', 'ψ', 'psi', 'bar', 'negative', 'higher', 'lower'] },
  chain_explain: { minWords: 15, keywords: VOCAB.osmosis },
  treat_reflect: { minWords: 15, keywords: VOCAB.treatment },
  treat_why: { minWords: 6, keywords: VOCAB.treatment },
  r_chain: { minWords: 20, keywords: VOCAB.runner },
  r_ruleout: { minWords: 12, keywords: ['temperature', 'temp', 'glucose', 'sugar', '37', '98'] },
  r_unknown: { minWords: 10 },
};
