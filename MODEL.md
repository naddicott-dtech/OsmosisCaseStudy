# Science model and sources

Written 2026-09-23. Numbers are chosen to be physiologically plausible for teaching. They are **rules of the model, not clinical guidance.**

## Physiology engine (`src/engine/physiology.ts`)

- **Body water:** calf 45 kg × 0.70 = 31.5 L total body water (neonatal calves are roughly 70% water).
- **Blood sodium after an IV bag:** each increment of fluid is mixed into total body water: `Na_new = (Na·TBW + Na_fluid·ΔV) / (TBW + ΔV)`. This matches the Adrogué–Madias estimate of (Na_fluid − Na)/(TBW + 1) per litre. It ignores urine output, ongoing diarrhea, and potassium.
  - Fluids: sterile water 0 mEq/L (thought experiment, causes hemolysis), D5W 0 mEq/L (free water once dextrose is metabolized), 0.9% saline 154 mEq/L, 3% saline 513 mEq/L.
- **Plasma osmolality** = 2·Na + 15 (glucose and urea).
- **Brain water:** `dV/dt = K · (S/V − P_osm − E·(V − 1))`. S = 295 means a brain at Na 140 has V = 1. E = 700 represents tissue and skull resistance. K gives a time constant of about 10 min.
- **Pressure inside the skull:** `ICP = 4 + exp(0.55 · swelling%)`, giving about 5 mmHg at Na 140 and about 33 mmHg at Na 110.
- **Status:** seizing if ICP > 25; stable once ICP ≤ 20 (with hysteresis); "critical" if ICP > 40.
- **Overcorrection:** flagged if Na rises more than 10 mEq/L above its value at the start of the trial. Human guidance is ≤ 8–10 mEq/L in 24 h; a published calf case targeted 12 mmol/L/day. No calf-specific numeric limit was verified, so this is extrapolated.

Verified outcomes (engine tests): untreated Na 110 → seizing. 1 L D5W or sterile water → worse. 1 L 0.9% saline → +1.3 mEq/L, still seizing. 250 mL 3% → partial. 500 mL 3% (or 2 × 250 mL) → seizures stop safely (+6.2). 1 L 3% → seizures stop but overcorrects (+12.4).

## Known simplifications (also shown in the in-app "About & model notes")

- There are two compartments. The "barrier" combines the blood–brain barrier and brain cell membranes. In real brains, aquaporin-4 sits mostly on astrocyte end-feet, and astrocytes swell first.
- Seizures are triggered by the pressure threshold only. In reality, low sodium also changes neuron excitability directly.
- Brain adaptation (osmolyte loss over about 48 h) is not simulated dynamically. It appears only as the overcorrection rule and its explanation.
- Brain swelling is drawn ×4.5 so it can be seen. Particle crossings are biased by the engine's net flux, so the animation illustrates the model rather than simulating molecules.
- **Membrane mini-lab (`src/engine/membrane.ts`):**
  - **Two layers.** The water levels follow a macro model of the average behavior of a real solution. Water flux from each side is proportional to how crowded water is at that face of the membrane (salt takes up room, so salty water has fewer water molecules per volume) times (1 + 0.8 × level difference), the back-pressure of a taller column. Nothing sets the direction; it comes out of those rules.
  - **The dots are a sample of about 350 molecules.** Each walks at random and crosses both ways, through aquaporins (fast) and through the lipid bilayer (slow). They are steered only enough to stay in step with the macro counts.
  - **Why two layers:** an earlier all-particle version showed about ±3% random wander in the levels at any Chromebook-affordable particle count. That is real statistics for a few hundred molecules, but it read as broken.
- **Brain view:** the same molecule world, but the net direction is set by the physiology engine's flux so the picture matches the gauges. Blood flows and carries Na⁺ and Cl⁻ in proportion to plasma sodium.
- The cell-in-a-beaker lab uses Boyle–van 't Hoff (40% of cell volume doesn't change with water). Lysis begins at 160% relative volume, which lands at about 0.45% NaCl and matches the classic osmotic fragility onset.

## Lab values

Juniper's reference ranges come from the **Cornell Animal Health Diagnostic Center bovine chemistry (Cobas) reference intervals**, verified 2026-09-23. The page does not state an age group, so pre-ruminant calves can differ, notably in glucose and total protein. PCV 22–43% comes from neonatal-calf literature (PubMed 8269362, not independently re-read). Vital-sign ranges are typical calf values and were not verified against a primary source.

Scenario plausibility: a published case of a calf with Na 116 mmol/L, tremors, and neurological signs, treated with cautious sodium correction (PMC5606621). Hyponatremia after water-only replacement ("water intoxication") is recognized in calves.

Runner: exercise-associated hyponatremia is defined as Na < 135. Treatment for severe symptoms is 100 mL 3% saline, repeatable up to 3 total boluses. Sports drinks are hypotonic. Weight gain signals overdrinking. These come from Wilderness Medical Society guidance as summarized in *Am Fam Physician* 2021;103(4):252. Runner values are invented for the case.

## Before reuse or revision

A teacher play-through for accuracy and tone is still recommended. Veterinary review of the calf values would strengthen the case.
