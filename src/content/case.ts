// All case text and data. Numbers for Juniper's labs use cattle reference intervals from
// Cornell AHDC (Cobas chemistry; age not specified — young calves can differ). See MODEL.md.

export interface LabValue {
  id: string;
  name: string;
  plain: string;
  value: number;
  unit: string;
  low: number;
  high: number;
  /** Which body system this measurement mainly tells us about. */
  system: string;
}

export const PATIENT = {
  name: 'Juniper',
  description: '3-week-old Holstein heifer calf, 45 kg',
  pronoun: 'she',
};

export const HISTORY = [
  'Juniper has had watery diarrhea for three days.',
  'Yesterday the farmer stopped her milk and gave her buckets of plain water because she seemed so thirsty. She drank a lot.',
  'This morning she would not stand up. Now she is lying on her side, trembling, and every few minutes her legs paddle and her head pulls back — seizures.',
];

export const EXAM_TOOLS = [
  {
    id: 'thermometer',
    label: 'Thermometer',
    icon: '🌡️',
    finding: 'Rectal temperature 38.9 °C (typical calf range 38.5–39.5 °C). No fever.',
    flag: 'normal' as const,
  },
  {
    id: 'stethoscope',
    label: 'Stethoscope',
    icon: '🩺',
    finding: 'Heart rate 148 beats/min (typical 100–140). Breathing 44 breaths/min (typical 30–40). Lungs sound clear.',
    flag: 'high' as const,
  },
  {
    id: 'skin',
    label: 'Skin tent & eyes',
    icon: '✋',
    finding: 'A pinch of neck skin takes 4 seconds to flatten (normal under 2 s). Eyes slightly sunken. Signs of dehydration.',
    flag: 'high' as const,
  },
  {
    id: 'blood',
    label: 'Blood sample',
    icon: '💉',
    finding: 'Blood drawn from the jugular vein and sent to the analyzer. Results are on the Lab Report.',
    flag: 'normal' as const,
  },
];

export const LABS: LabValue[] = [
  { id: 'na', name: 'Sodium (Na⁺)', plain: 'Main solute dissolved in blood plasma', value: 110, unit: 'mEq/L', low: 134, high: 144, system: 'Water & salt balance' },
  { id: 'cl', name: 'Chloride (Cl⁻)', plain: 'Travels with sodium', value: 78, unit: 'mEq/L', low: 92, high: 99, system: 'Water & salt balance' },
  { id: 'k', name: 'Potassium (K⁺)', plain: 'Needed for nerve and heart signals', value: 6.8, unit: 'mEq/L', low: 4.0, high: 5.9, system: 'Nerves & heart' },
  { id: 'hco3', name: 'Bicarbonate (HCO₃⁻)', plain: 'Buffer that keeps blood pH steady', value: 15, unit: 'mEq/L', low: 22, high: 30, system: 'Blood pH' },
  { id: 'glu', name: 'Glucose', plain: 'Blood sugar — fuel for cells', value: 72, unit: 'mg/dL', low: 57, high: 79, system: 'Energy supply' },
  { id: 'bun', name: 'Blood urea nitrogen (BUN)', plain: 'Waste the kidneys filter out', value: 34, unit: 'mg/dL', low: 7, high: 19, system: 'Kidneys' },
  { id: 'pcv', name: 'Packed cell volume (PCV)', plain: 'Percent of blood that is red blood cells', value: 44, unit: '%', low: 22, high: 43, system: 'Blood volume' },
  { id: 'osm', name: 'Calculated osmolality', plain: 'Total dissolved particles in plasma', value: 236, unit: 'mOsm/kg', low: 270, high: 300, system: 'Water & salt balance' },
];

export function labFlag(l: LabValue): 'low' | 'high' | 'normal' {
  if (l.value < l.low) return 'low';
  if (l.value > l.high) return 'high';
  return 'normal';
}

// ---------- Causal chain ----------

export interface ChainCard {
  id: string;
  text: string;
  /** Correct position (0-based), or -1 for a distractor. */
  order: number;
  /** Feedback when this distractor is placed in the chain. */
  misconception?: string;
}

export const CHAIN_CARDS: ChainCard[] = [
  { id: 'c1', order: 0, text: 'Diarrhea removes water AND sodium from the body.' },
  { id: 'c2', order: 1, text: 'The lost fluid is replaced with plain water, which has no sodium.' },
  { id: 'c3', order: 2, text: 'Blood sodium falls, so blood becomes hypotonic (less concentrated than the inside of brain cells).' },
  { id: 'c4', order: 3, text: 'By osmosis, water moves out of the blood into brain cells through aquaporins.' },
  { id: 'c5', order: 4, text: 'Brain cells swell, and pressure inside the skull rises.' },
  { id: 'c6', order: 5, text: 'Squeezed, swollen neurons fire abnormally → tremors and seizures.' },
  {
    id: 'd1', order: -1,
    text: 'Sodium ions move from the blood into the brain.',
    misconception: 'Sodium ions cannot cross the blood–brain barrier quickly. That is exactly why WATER is the thing that moves. Look again at the brain simulation: which particles crossed?',
  },
  {
    id: 'd2', order: -1,
    text: 'Brain cells shrink as water leaves them.',
    misconception: 'Check the direction. Water moves toward the side with MORE dissolved solute. Is that the blood or the brain cells in Juniper?',
  },
  {
    id: 'd3', order: -1,
    text: 'Water moves toward the side that already has more water.',
    misconception: 'Reversed. Net water movement is toward the side with more solute (and therefore less free water).',
  },
  {
    id: 'd4', order: -1,
    text: 'A high fever damages the brain.',
    misconception: 'Evidence check: Juniper\'s temperature was 38.9 °C, which is normal for a calf. Your chain should match the data.',
  },
];

// ---------- Brain view prediction ----------

export const BRAIN_PREDICTION = {
  question: 'Yesterday Juniper\'s blood sodium was a healthy 140 mEq/L. As she drank plain water it fell to 110. Solutes inside her brain cells stayed at the healthy level. As her blood sodium falls, which way will MORE water move?',
  choices: [
    { id: 'into', text: 'From the blood into the brain', correct: true },
    { id: 'out', text: 'From the brain into the blood', correct: false },
    { id: 'none', text: 'No net movement — water stays put', correct: false },
    { id: 'na', text: 'Water stays; sodium moves into the brain instead', correct: false },
  ],
  feedback: {
    into: 'Your prediction matches the model. Watch how many water molecules cross each way. Water moves in BOTH directions, but more moves into the brain.',
    out: 'Watch carefully. Count the crossings each way. Which side has more dissolved solute, and so less free water?',
    none: 'Watch the crossing counters. Is there a difference in concentration across the barrier? If there is, will the movement even out?',
    na: 'Watch the sodium ions (yellow). Do any of them cross the barrier? What does cross?',
  } as Record<string, string>,
};

// ---------- Treatment outcome text ----------

export const OUTCOME_TEXT: Record<string, { title: string; body: string }> = {
  worse: {
    title: 'Worse: more water rushed into the brain',
    body: 'This fluid has no sodium, so it diluted Juniper\'s blood even more. Her blood became MORE hypotonic compared with her brain cells, so even more water moved into the brain by osmosis. Pressure rose.',
  },
  no_help: {
    title: 'Little change',
    body: 'This dose barely changed blood sodium, so the concentration difference between blood and brain stayed about the same. Water kept its net movement into the brain.',
  },
  partial: {
    title: 'Some improvement — seizures continue',
    body: 'Blood sodium rose a little, so the osmotic pull into the brain got weaker and some water moved back out. Pressure dropped, but not enough to stop the seizures.',
  },
  success: {
    title: 'Seizures stop',
    body: 'Raising blood sodium made the blood slightly more concentrated, so water moved OUT of the swollen brain cells into the blood. Pressure dropped below the seizure threshold. Juniper lifts her head. The vet will now finish correcting her sodium slowly over the next few days with electrolyte fluids and milk.',
  },
  overcorrected: {
    title: 'Seizures stop — but sodium rose too fast',
    body: 'The seizures stopped, but Juniper\'s blood sodium rose more than about 10 mEq/L in one day. After several days of low sodium, brain cells have adjusted by getting rid of some of their own solutes. A fast jump in blood sodium can now pull too much water OUT of brain cells and damage the insulation (myelin) on neurons. Signs can appear days later. Doctors and vets raise sodium only a little at first, just enough to stop seizures.',
  },
};

export const HEMOLYSIS_TEXT =
  'Also: plain sterile water entering a vein is extremely hypotonic to red blood cells. Water rushes into them and they burst (hemolysis). This is why sterile water is never given straight into a vein.';

// ---------- Runner transfer case ----------

export const RUNNER = {
  intro:
    'Race day. Runner #214, age 34, finished a marathon in 5 hours 40 minutes. They stopped at every water station and drank extra "to be safe." Twenty minutes after finishing they became confused, complained of a headache and nausea, and had a seizure in the medical tent.',
  labs: [
    { id: 'r_na', name: 'Blood sodium', value: 124, unit: 'mEq/L', low: 135, high: 145 },
    { id: 'r_glu', name: 'Blood glucose', value: 98, unit: 'mg/dL', low: 70, high: 140 },
    { id: 'r_temp', name: 'Core temperature', value: 37.4, unit: '°C', low: 36.5, high: 38.0 },
    { id: 'r_mass', name: 'Body mass change during race', value: 1.4, unit: 'kg', low: -3, high: 0 },
    { id: 'r_hr', name: 'Heart rate', value: 96, unit: 'beats/min', low: 60, high: 100 },
  ] as (Omit<LabValue, 'plain' | 'system'>)[],
  questions: [
    { id: 'r_chain', label: 'Explain the chain of events from the runner\'s drinking to their confusion and seizure. Use the words hypotonic, osmosis, and brain cells.' },
    { id: 'r_ruleout', label: 'Heat stroke and low blood sugar can also cause confusion or collapse. Which measurements make those explanations less likely? Explain.' },
    { id: 'r_unknown', label: 'What can\'t these data tell us? Name one thing you would want to measure or know next, and why.' },
  ],
  treatmentChoice: {
    question: 'The medical team is deciding what to give. Which is the best first step?',
    choices: [
      { id: 'water', text: 'More water to rehydrate', feedback: 'More plain water would dilute blood sodium further. The runner gained weight during the race, so they already have too much water, not too little.' },
      { id: 'sports', text: 'A sports drink, because it has electrolytes', feedback: 'Sports drinks contain some sodium, but far less than blood. They are still hypotonic to blood, so drinking a lot of them can still lower blood sodium.' },
      { id: 'hts', text: 'A small IV dose (100 mL) of 3% hypertonic saline, repeated if symptoms continue', feedback: 'This matches wilderness/sports-medicine guidance for severe symptoms. A small hypertonic dose raises blood sodium a little, pulling water out of swollen brain cells, without raising sodium too fast.' },
      { id: 'ns', text: 'A large IV bag of 0.9% normal saline', feedback: 'Normal saline raises sodium only slowly and adds more volume to someone who already has too much water. It is not the fast fix for brain swelling.' },
    ],
    best: 'hts',
  },
};

export const INTAKE_PROMPT =
  'Before running any tests: what do you think could be causing Juniper\'s trembling and seizures? What would you want to check first, and why?';

export const LAB_PROMPTS = [
  { id: 'labs_systems', label: 'Which body systems look like they are still working normally, based on the evidence? Name at least one, and say which measurement supports it.' },
  { id: 'labs_link', label: 'Juniper had diarrhea and then drank lots of plain water. Which abnormal value do you think is most connected to her seizures? Why?' },
];

export const BRAIN_EXPLAIN = {
  id: 'brain_explain',
  label: 'In your own words: why does more water move into the brain than out of it? Mention what could and could not cross the barrier.',
};

export const TREAT_PREDICT_LABEL = 'Before you start the IV: what do you predict will happen to the water in Juniper\'s brain, and why?';

export const REFLECT_PROMPT = {
  id: 'treat_reflect',
  label: 'Explain why the treatment that worked (or would work) moves water OUT of the brain. Why is "just give more fluids" not always the right answer?',
};

export const MINILAB_PROMPTS = {
  membrane: {
    id: 'lab_membrane',
    label: 'Put sodium on one side with the aquaporin membrane. What happened to the water levels? Then switch to "leaky". Why does the result change?',
  },
  cell: {
    id: 'lab_cell',
    label: 'Describe what happened to the red blood cell in a hypotonic, isotonic, and hypertonic solution. Which one matches Juniper\'s brain cells?',
  },
  psi: {
    id: 'lab_psi',
    label: '(Extension) Use your water potential values to explain which way water moves between Juniper\'s blood and her brain cells.',
  },
};
