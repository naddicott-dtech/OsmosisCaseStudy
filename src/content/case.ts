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

export const HISTORY_SPEAKER = 'Dana, Juniper\'s owner (first year raising a calf for 4-H)';

export const HISTORY = [
  '"Thanks for coming out so fast, Doc. We bought Juniper about three weeks ago. She\'s a bottle calf, so she\'s not with her mother: we feed her milk from a big bottle twice a day. She was doing great until Monday, when she got the scours. That\'s what farmers call diarrhea in calves: runny, watery, all over the pen."',
  '"I read up online, and everything said the big danger with diarrhea is dehydration. So I\'ve been really on top of keeping her hydrated. I also read that you shouldn\'t feed milk to a calf with diarrhea, so we stopped her milk bottles and gave her water instead. I made sure she always had a big bucket of fresh, clean water. She\'s been so thirsty! I\'ve refilled that bucket five or six times since yesterday."',
  '"Last night she was shivering, so my daughter put her old horse blanket on her and we moved her into the shed out of the wind."',
  '"This morning she was wobbly and bumped her head on the gate trying to get up. Now she won\'t stand at all. She\'s lying on her side trembling, and every few minutes her legs paddle and her head pulls back. Is she going to be okay?"',
];

export const EXAM_TOOLS = [
  {
    id: 'thermometer',
    image: 'exam-thermometer',
    alt: 'A digital rectal thermometer reading 38.9 degrees Celsius.',
    label: 'Thermometer',
    icon: '🌡️',
    finding: 'Rectal temperature 38.9 °C (typical calf range 38.5–39.5 °C). Normal, even under the blanket.',
    flag: 'normal' as const,
  },
  {
    id: 'stethoscope',
    image: 'exam-stethoscope',
    alt: 'A stethoscope pressed against the left side of Juniper\'s chest, just behind her elbow, where the heart is loudest.',
    label: 'Stethoscope',
    icon: '🩺',
    finding: 'Heart rate 148 beats/min (typical 100–140). Breathing 44 breaths/min (typical 30–40). Lungs sound clear.',
    flag: 'high' as const,
  },
  {
    id: 'skin',
    image: 'exam-eye',
    alt: 'Close-up of Juniper\'s left eye. It is slightly sunken, with a small gap between the eyeball and the lower eyelid.',
    label: 'Skin tent & eyes',
    icon: '✋',
    finding: 'A pinch of neck skin takes 4 seconds to flatten (normal under 2 s). Eyes slightly sunken. Signs of dehydration.',
    flag: 'high' as const,
  },
  {
    id: 'head',
    image: 'exam-head',
    alt: 'Juniper\'s head from the side. There is a small scrape just above her left eye, with no swelling.',
    label: 'Head & eyes check',
    icon: '🔦',
    finding: 'A small scrape above her left eye. No swelling, no soft spots, and no blood in the ears or nose. Both pupils are the same size and react to light. Her eyes flick side to side during the seizures.',
    flag: 'normal' as const,
  },
  {
    id: 'blood',
    image: 'exam-blood',
    alt: 'A red-topped blood tube, about three-quarters full, labeled Juniper 9/24/26.',
    label: 'Blood sample',
    icon: '💉',
    finding: 'Blood drawn from the jugular vein into a red-top tube. The serum goes to the analyzer. Results are on the Lab Report below.',
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

export const CHAIN_EXPLAIN_LABEL = 'Pick the ONE link in the chain that you think is most important for explaining the seizures. Say which link it is in words (not just its number), then explain it in your own words, as if to the farmer.';
/** After this many unsuccessful checks, suggest asking the teacher. */
export const CHAIN_HELP_AFTER = 10;
export const CHAIN_HELP_TEXT = 'It seems like you may be having some trouble with this activity. If you\'re working on this in class, your teacher would be happy to help.';

export const CHAIN_CARDS: ChainCard[] = [
  { id: 'c1', order: 0, text: 'Diarrhea removes both water AND sodium from Juniper\'s body.' },
  { id: 'c2', order: 1, text: 'Trying to rehydrate her, the owner stops her milk (which contains salts) and gives her plain water instead. The water replaces lost fluid but not lost sodium.' },
  { id: 'c3', order: 2, text: 'Blood sodium falls, so blood becomes hypotonic (less concentrated than the inside of brain cells).' },
  { id: 'c4', order: 3, text: 'By osmosis, water moves out of the blood and into brain cells, across the membrane and through aquaporins.' },
  { id: 'c5', order: 4, text: 'Brain cells swell, and pressure inside the skull rises.' },
  { id: 'c6', order: 5, text: 'Squeezed, swollen neurons fire abnormally, causing tremors and seizures.' },
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
    misconception: 'Reversed. Net water movement is toward the side with more solute (and so fewer water molecules in the same space).',
  },
  {
    id: 'd4', order: -1,
    text: 'The horse blanket made her overheat, and the heat damaged her brain.',
    misconception: 'Evidence check: her temperature was 38.9 °C, normal for a calf, even under the blanket. Your chain should match the data.',
  },
  {
    id: 'd5', order: -1,
    text: 'Bumping her head on the gate caused bleeding and swelling in her brain.',
    misconception: 'Evidence check: the head exam found only a small scrape, with no swelling and equal pupils. She was already wobbly BEFORE the bump. The bump was a result of her illness, not the cause.',
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
  setback: {
    title: 'Setback: water moved back INTO the brain',
    body: 'Her seizures are still stopped for now, but this fluid lowered her blood sodium. Diluting the blood makes it more hypotonic compared with her brain cells, so water moves back INTO the brain by osmosis and pressure creeps up. A fluid with little or no sodium works against the treatment.',
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
    body: 'Raising blood sodium made the blood slightly more concentrated, so water moved OUT of the swollen brain cells into the blood. Pressure dropped below the seizure threshold. Juniper lifts her head. The vet will now finish correcting her sodium slowly over the next few days with electrolyte drinks and her normal milk feedings.',
  },
  overcorrected: {
    title: 'Seizures stop — but sodium rose too fast',
    body: 'The seizures stopped, but Juniper\'s blood sodium rose more than about 10 mEq/L in one day. After several days of low sodium, brain cells have adjusted by getting rid of some of their own solutes. A fast jump in blood sodium can now pull too much water OUT of brain cells and damage the insulation (myelin) on neurons. Signs can appear days later. Doctors and vets raise sodium only a little at first, just enough to stop seizures.',
  },
};

export const HEMOLYSIS_TEXT =
  'Also: plain sterile water entering a vein is extremely hypotonic to red blood cells. Water rushes into them and they burst (hemolysis). This is why sterile water is never given straight into a vein.';

// ---------- Runner transfer case ----------

/**
 * Hidden for now (Neal, 2026-09-23): it previews the Marathon Runner performance task too closely.
 * A reverse-direction transfer case (hypernatremia, e.g. drinking seawater) is the planned replacement.
 */
export const ENABLE_RUNNER = false;

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
  'Before running any tests: list TWO possible causes of Juniper\'s trembling and seizures. For each one, what evidence would help you tell whether it is right?';

export const LAB_PROMPTS = [
  { id: 'labs_systems', label: 'Which body systems look like they are still working normally, based on the evidence? Name at least one, and say which measurement supports it.' },
  { id: 'labs_link', label: 'Which abnormal value do you think is most connected to her seizures? Use something from Dana\'s story to explain why.' },
];

export const BRAIN_EXPLAIN = {
  id: 'brain_explain',
  label: 'In your own words: why does more water move into the brain than out of it? Mention what could and could not cross the barrier.',
};

/** Shown with the trial scorecard once the student has met the goal (a safe trial, or 3 trials). */
export const TREAT_GOAL_MET = 'You\'ve met the goal for this step. To finish, answer the final question below. More trials are optional.';
export const TREAT_GOAL_MET_TRIES = 'You\'ve done 3 trials, so you can finish now: answer the final question below. More trials are optional.';

export const TREAT_PREDICT_LABEL = 'Before you start the IV: what do you predict will happen to the water in Juniper\'s brain, and why?';
/** The written reason is required for this many IV orders (across all trials), then optional. */
export const TREAT_WHY_REQUIRED = 2;
export const TREAT_WHY_OPTIONAL_HINT = 'Optional from now on. Add a reason if your thinking has changed.';

export const REFLECT_PROMPT = {
  id: 'treat_reflect',
  label: 'Explain why the treatment that worked (or would work) moves water OUT of the brain. Why is "just give more fluids" not always the right answer?',
};

export const MINILAB_PROMPTS = {
  membrane: {
    id: 'lab_membrane',
    label: 'Start with "Salt water | Pure water" and bilayer + aquaporins. Which side gained water, and why, if every water molecule moves at random? Then compare "Lipid bilayer only" and "Leaky". What changed, and why?',
  },
  cell: {
    id: 'lab_cell',
    label: 'Describe what happened to the red blood cell in a hypotonic, isotonic, and hypertonic solution. Which one matches Juniper\'s brain cells?',
  },
  /** Retired single prompt (before 2026-09-25). Still reported, and still counts, for students who answered it. */
  psi: {
    id: 'lab_psi',
    label: 'Use your water potential values to explain which way water moves between Juniper\'s blood and her brain cells.',
  },
};

/** Several students wrote that Juniper's brain cells "burst" like the red blood cell. */
export const CELL_VS_BRAIN_NOTE = 'Careful connecting this to Juniper: a red blood cell floating free can swell until it bursts. Brain cells are packed inside the skull, so they swell only a little before pressure builds. The danger for Juniper is that rising pressure, not bursting cells.';

/** Honors water potential, in steps: one calculation per compartment, then a direction choice. */
export const PSI_PROMPTS = {
  blood: {
    id: 'lab_psi_blood',
    label: 'Calculate Ψs for Juniper\'s BLOOD. Write Ψs = −iCRT with her numbers plugged in, then your answer with units.',
  },
  cell: {
    id: 'lab_psi_cell',
    label: 'Calculate Ψs for her BRAIN CELLS the same way: numbers plugged in, then your answer with units.',
  },
  dir: {
    id: 'lab_psi_dir',
    firstId: 'lab_psi_dir_first',
    label: 'Based on your two values, which way does water move?',
    correct: 'blood_to_brain',
    choices: [
      { id: 'blood_to_brain', text: 'From her blood into her brain cells' },
      { id: 'brain_to_blood', text: 'From her brain cells into her blood' },
      { id: 'none', text: 'No net movement' },
    ],
    feedback: {
      blood_to_brain: 'Yes. Her blood\'s Ψs is less negative (higher) than her brain cells\', and water moves from higher to lower water potential. That is why her brain cells swell.',
      brain_to_blood: 'Check the signs. The MORE negative number is the LOWER water potential, and water moves toward the lower side. Which of your two values is more negative?',
      none: 'Your two values are not equal. Compare them: which one is more negative? Water moves toward the more negative (lower) side.',
    } as Record<string, string>,
  },
  signTip: 'Tip: solute potential is never positive. Check the minus sign in −iCRT.',
  /** Juniper's values are fixed case data (her labs and exam), so every Honors answer can be checked. */
  given: { tempC: 38.9, bloodM: 0.11, cellM: 0.145 },
};

// ---------- Treatment goal and trial verdicts ----------

export const TREAT_GOAL = {
  title: 'Your goal: stop the seizures safely',
  points: [
    'Raise blood sodium just enough to pull water back OUT of her swollen brain cells.',
    'Keep the rise to about 10 mEq/L or less in the first day. Rising faster can damage her brain in a new way.',
    'You do NOT need to reach normal sodium today. Vets finish that slowly over several days.',
  ],
  how: 'Each trial is up to 4 rounds of IV fluid, about one day. In each round you choose a fluid and an amount, predict, then watch 6 hours. After each round, reassess: give another round, or end the trial. Every new trial starts with Juniper as she was when you arrived.',
  requirement: 'To move on: stabilize Juniper safely in one trial, or finish 3 trials.',
};

export const VERDICT_TEXT: Record<string, { title: string; body: string }> = {
  safe: {
    title: 'Stabilized safely',
    body: 'Seizures stopped and her sodium rose only a little. This is what vets aim for on day one. Her sodium is still low, and it will be corrected slowly over the next few days.',
  },
  overcorrected: {
    title: 'Trial over: sodium rose too fast',
    body: 'Her seizures may have stopped, but her sodium rose more than about 10 mEq/L in the first day. After days of low sodium, her brain cells had adjusted. A fast rise now pulls too much water out of them and can damage the insulation (myelin) on neurons. The goal was never "normal sodium today."',
  },
  harmed: {
    title: 'Trial over: harmful fluid',
    body: 'Sterile water entering a vein bursts red blood cells (hemolysis). It is never given this way.',
  },
  not_stabilized: {
    title: 'Not stabilized',
    body: 'Juniper was still seizing when this trial ended. Her blood needed to become a little more concentrated to pull water out of her brain.',
  },
};
