import { signal, effect } from '@preact/signals';
import { createPatient, type FluidId, type OutcomeKind, type PhysState } from './engine/physiology';

// Everything a student does is kept on this device only (localStorage). Nothing is sent anywhere.

export interface TreatmentLog {
  trial: number;
  fluid: FluidId;
  volumeL: number;
  predictedEffect: string;
  prediction: string;
  outcome: OutcomeKind;
  naBefore: number;
  naAfter: number;
  icpBefore: number;
  icpAfter: number;
  hemolysis: boolean;
}

export interface Saved {
  version: 1;
  step: number;
  answers: Record<string, string>;
  toolsUsed: string[];
  labFlags: Record<string, 'low' | 'normal' | 'high'>;
  labCheck: { attempts: number; firstScore: string | null; done: boolean };
  brainPrediction: string | null;
  brainWatched: boolean;
  chain: { current: string[]; attempts: number; firstAttempt: string[] | null; solved: boolean };
  cellSeen: { hypotonic: boolean; isotonic: boolean; hypertonic: boolean };
  treatments: TreatmentLog[];
  trial: number;
  patient: PhysState;
  runnerFlags: Record<string, 'low' | 'normal' | 'high'>;
  runnerCheck: { attempts: number; firstScore: string | null; done: boolean };
  runnerChoice: { first: string | null; current: string | null };
  reduceMotion: boolean;
  honors: boolean;
  startedAt: string;
}

const KEY = 'osmosis-case-study-v1';

export function freshState(): Saved {
  const prefersReduced =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  return {
    version: 1,
    step: 0,
    answers: {},
    toolsUsed: [],
    labFlags: {},
    labCheck: { attempts: 0, firstScore: null, done: false },
    brainPrediction: null,
    brainWatched: false,
    chain: { current: [], attempts: 0, firstAttempt: null, solved: false },
    cellSeen: { hypotonic: false, isotonic: false, hypertonic: false },
    treatments: [],
    trial: 1,
    patient: createPatient(),
    runnerFlags: {},
    runnerCheck: { attempts: 0, firstScore: null, done: false },
    runnerChoice: { first: null, current: null },
    reduceMotion: !!prefersReduced,
    honors: false,
    startedAt: new Date().toISOString(),
  };
}

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Saved;
      if (parsed.version === 1) return { ...freshState(), ...parsed };
    }
  } catch {
    /* storage unavailable or corrupt — start fresh */
  }
  return freshState();
}

export const saved = signal<Saved>(load());

let timer: ReturnType<typeof setTimeout> | undefined;
function persist() {
  clearTimeout(timer);
  try {
    localStorage.setItem(KEY, JSON.stringify(saved.value));
  } catch {
    /* ignore — progress just won't survive a reload */
  }
}
effect(() => {
  void saved.value;
  clearTimeout(timer);
  timer = setTimeout(persist, 200);
});
if (typeof window !== 'undefined') {
  // Flush immediately if the tab is hidden, closed, or reloaded.
  window.addEventListener('pagehide', persist);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && persist());
}

export function update(fn: (s: Saved) => Partial<Saved>) {
  saved.value = { ...saved.value, ...fn(saved.value) };
}

export function setAnswer(id: string, text: string) {
  update((s) => ({ answers: { ...s.answers, [id]: text } }));
}

export function goTo(step: number) {
  update(() => ({ step }));
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0 });
    requestAnimationFrame(() => document.getElementById('main-heading')?.focus());
  }
}

export function resetAll() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  saved.value = freshState();
}
