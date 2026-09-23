# Osmosis Case Study — build plan

Drafted 2026-09-23. **Status (2026-09-23 evening):** slices 0–6 built as v1.0 for classroom use on 2026-09-24. Analytics/Replit deferred. See README.md for usage and MODEL.md for the science. Defaults chosen by the assistant, pending Neal's review: patient named Juniper; Ψ calculator labeled optional extension; runner case is the final Check item in the report; submission by copy/download into Canvas.

**Revision 2 (2026-09-23, after Neal's feedback):**
- Rewrote the brain and membrane simulations, with water crossing the bilayer, emergent net flow, and no level jitter.
- Fixed the causal-chain bug: a missing link was being reported as "out of order".
- Rewrote the owner narrative with false clues.
- Added the head exam, an answer-quality check, the IV visualization, and the Blender calf.
- Water potential is now Honors-required.

Neal's decisions: patient name Juniper is fine; water potential is required for Honors and optional for everyone else; reference ranges and the correction limit are OK.

Remaining **Decision needed** items below are still open for later editions.

## 1. Purpose and fit

A browser case study for the Marathon Runner unit (teacher Unit 2). Students diagnose a calf with tremors after diarrhea, find low blood sodium, look inside the brain to see water moving by osmosis, and choose IV fluid, predicting the result before they see it.

The case matters because it has **the same mechanism as exercise-associated hyponatremia**. Sweat or diarrhea loses sodium and water. Replacing that with plain water dilutes blood sodium, and water then moves into brain cells. The activity ends with a runner transfer case so the calf is practice for the performance task, not a side story. Historical unit plans place this around "water balance" and "review/hyponatremia."

Evidence target: CI1 Structure & Function (organ → cell → molecule → homeostasis). This is last year's outcome label; confirm the current course mapping.

### What students should be able to do afterward
1. Explain a causal chain from fluid loss or replacement → blood [Na⁺] → water movement across a membrane → cell volume and pressure → nervous-system symptoms.
2. Predict the direction of net water movement from solute concentrations on each side of a semi-permeable membrane.
3. Justify a treatment choice, and explain why the other choices fail or cause harm.
4. Transfer: apply the same chain to a runner's data.

## 2. Originality and copyright

The pasted description summarizes ExploreLearning's commercial "Osmosis" STEM Case. We will build an **original activity that teaches the same concepts**. We will not copy their text, art, UI, question wording, or character names. Suggested changes: a new patient name (for example "Juniper, 3-week-old Holstein calf"), our own illustrations, and our own prompts. The app will not use their product name and will not imply any affiliation. **Decision needed:** patient name.

## 3. Science corrections to the pasted spec

The pasted description is a useful outline but contains several simplifications that would teach misconceptions. Planned fixes:

| Pasted spec | Problem | Plan |
|---|---|---|
| Causal chain "Diarrhea → Sodium loss → Hypotonic blood" | Diarrhea loses water *and* sodium. Blood becomes hypotonic mainly when the losses are **replaced with plain water** (drinking, or water-only fluids). | Add the history that the calf was given plain water / drank heavily. This is the direct parallel to a runner over-drinking plain water. |
| Diarrhea with "normal potassium" | Calf diarrhea classically causes dehydration, metabolic acidosis, and often **high K⁺**. | Show realistic secondary values (low bicarbonate, possibly high K⁺, high hematocrit) as "systems affected" evidence. Advanced students explain secondary effects. Values need a vet reference check (§9). |
| IV option "Pure distilled water" | Pure water is never given IV; it bursts red blood cells. | Keep it as a **thought-experiment prediction** ("What would happen if…"), clearly labeled "never done clinically." For the real menu, use D5W (dextrose is metabolized, so it behaves like free water). |
| "Normal saline does not pull water fast enough" (hard-coded) | 0.9% saline has 154 mEq/L Na⁺, which is *higher* than the calf's 110. It raises Na⁺ slowly and restores volume. | Compute outcomes from concentrations. Nothing is hard-coded, so the engine explains its own results. |
| Hypertonic saline → "calf stands up, cured" | Too-fast correction of long-standing hyponatremia damages the brain (osmotic demyelination). | Include a rate choice. Correcting a little stops the seizures; overcorrecting gives a delayed-harm consequence. There is no single "click the right bag" answer. |
| Membrane mode "Semi-permeable (aquaporin only)" plus O₂ | O₂ crosses the lipid bilayer without aquaporins. | Membrane modes: lipid bilayer only / bilayer + aquaporins / leaky (all). O₂ crosses in every mode except a sealed barrier. |
| Tonicity "hypotonic → turgor/lysis" | Turgor is a plant-cell (cell wall) idea. | Animal cell: swells, then lyses. An optional toggle shows a plant cell (turgor) for comparison. |
| Endothelial aquaporins, neurons swelling | In the brain, AQP4 sits mostly on astrocyte end-feet, and astrocytes swell first. | Label the barrier "blood–brain barrier" and the cells "brain cells." Honors notes mention astrocytes. |
| Seizure = ICP > 25 | A model rule, not physiology. Low Na⁺ also changes neuron excitability. | Keep the threshold as a labeled **model rule** and show a "model limits" card. |
| Ψs = −iCRT calculator | Mainly AP/plant content. | Optional Honors extension only. |

All numbers (bovine Na⁺ range ~135–150 mEq/L, ICP, correction-rate limits) will be checked against a veterinary or physiology reference before release. Game thresholds are rules of the model, not clinical reference ranges.

## 4. Student flow (about 45–60 min core; extensions optional)

```
1 Intake → 2 Exam & Labs → 3 Inside the Brain → 4 Mini-labs → 5 Causal Chain → 6 Treat → 7 Runner Transfer → Report
```

1. **Intake.** The calf is down and trembling. History is told as an owner's story. **Engage prompt:** "What might be going on? What would you test?"
2. **Exam & Labs.** Click tools (thermometer, stethoscope, blood draw). Results appear on a chart **with normal ranges shown**, matching the runner data format. The student flags out-of-range values and says what still looks normal.
3. **Inside the Brain** (particle canvas). Blood vessel | blood–brain barrier with aquaporins | brain tissue. Na⁺ cannot cross; water moves both ways, with net flow toward higher solute. Live gauges show brain water volume, pressure, and a *non-flashing* activity trace. **Predict before play:** "Which way will more water move?"
4. **Mini-labs** (reachable from a Handbook button at any time):
   - Membrane chamber: choose the membrane, add O₂ / Na⁺ / H₂O, observe.
   - Cell in a beaker: salt slider 0–5%, the cell swells, stays the same, or shrinks. Hypotonic, isotonic, and hypertonic appear only after the student has observed each.
   - Honors: water-potential calculator.
5. **Causal Chain.** Order cards: fluid loss → water-only replacement → low blood Na⁺ → water enters brain cells → swelling/pressure → seizures. Includes **distractor cards** that encode misconceptions ("salt moves into the brain", "cells shrink"). Feedback is specific to the misconception. Keyboard-operable (no drag-only).
6. **Treat.** Choose a fluid and a rate, then write a prediction with a reason *before* infusing. The engine runs, and consequences are explained, not just "wrong." Retry is allowed, and the first prediction is kept in the report.
7. **Runner Transfer (Check).** A short new runner dataset: over-drank water during a marathon, confused, low Na⁺. The student writes the chain and says what the data can't tell us. No simulation help; this is the evidence item.
8. **Report.** A one-page summary of predictions, first attempts, chain, and written answers → **Copy / Download** for Canvas submission. No accounts, no names stored, no server.

## 5. Architecture (matches Climate Farmer conventions)

- **Stack:** Vite + TypeScript + Preact + @preact/signals, HTML5 Canvas for particles, Vitest (engine), Playwright (flows). Static build deployed by GitHub Actions `pages.yml` with `base: '/OsmosisCaseStudy/'`.
- **`src/engine/`**: pure, deterministic TypeScript with no DOM.
  - `physiology.ts`: a two-compartment model (blood, brain). The state is the pasted `SimulationState`, extended with `brain.osmolality`, `blood.osmolality`, `correctionRate_mEq_per_hr`, `elapsedSimHours`, `harmFlags`.
  - Fixed-step update: `flux = K · (osm_brain − osm_blood)` (positive = into brain) → brain volume → pressure through a compliance curve (steeper when swollen) → status by thresholds with hysteresis (seize > 25, stable ≤ 18).
  - Infusion mixes the Na⁺ and water of the bag's contents into blood each step. A too-fast rise in Na⁺ sets a delayed-harm flag.
  - `particles.ts`: the visual layer only. Particle counts come from engine concentrations, so animation never contradicts the numbers.
  - A seeded RNG makes the tests reproducible.
- **`src/content/`**: all case text, lab values, choices, and feedback as JSON/TS data, so a later runner or second case is a content file, not new code.
- **`src/ui/`**: screens, clipboard tabs (Labs / Reasoning / Orders), and the report.
- **State persistence:** localStorage only, wrapped in try/catch, so a reload doesn't lose progress on a Chromebook. Nothing leaves the device.

## 6. Accessibility and classroom reliability (requirements)

- **No flashing.** The seizure animation is slow tremor motion. The trace stays under 3 flashes/s with no strobe, and there is a Reduce Motion toggle that respects `prefers-reduced-motion`.
- Every drag has a keyboard or click alternative. Colors are never the only signal (gauges also carry text). Screen-reader labels on gauges.
- Works offline after first load (PWA cache optional), on Chromebooks, and at 1366×768 as well as phone width.
- Canvas performance: cap particles and pause when the tab is hidden.

## 7. Delivery slices (each is usable on its own)

| Slice | Contents | Acceptance check |
|---|---|---|
| 0 Scaffold | Vite/Preact/TS, Pages workflow, placeholder page live | URL loads on a school Chromebook |
| 1 Engine | physiology.ts plus tests: water-only lowers Na⁺ and raises brain volume; isotonic changes little; hypertonic lowers pressure; overcorrection flag; no NaN over 10,000 steps | `npm test` green |
| 2 Brain view | Particle canvas and gauges driven by the engine, prediction prompt | Direction of net flow matches the sign of the engine flux in every scenario |
| 3 Case shell | Intake → Labs → Treat → Report (the MVP, **usable in class**) | Full run in under 45 min, report copies cleanly |
| 4 Reasoning | Causal-chain builder with misconception feedback, runner transfer | Keyboard-only run-through |
| 5 Mini-labs | Membrane chamber, beaker cell, Honors Ψ calculator | Each mode shows the correct qualitative result |
| 6 Polish | Art, reduce-motion, offline cache, Playwright flows | a11y and flow tests pass |
| Later (Replit) | Optional backend for anonymous/pseudonymous response analytics | Separate privacy design first; see Biology privacy rules |

## 8. Decisions needed from Neal

1. **When is it needed?** As of 2026-09-09 the class was on day 2 of Marathon Runner, and water balance was around day 7 historically. If that is imminent, ship Slice 3 (MVP) first and use the Gizmo or handbook content for the remaining pieces.
2. Patient name and art style (simple flat vector is fastest).
3. Which pieces are Honors-only (Ψ calculator, astrocyte detail, overcorrection).
4. Submission path: copy/download to a Canvas assignment (recommended for GitHub Pages), or wait for Replit.
5. Is the runner-transfer item a Check for the bundle, or practice only?
6. OK to push this plan and scaffold to the **public** repo? The repo contains no student data by design.

## 9. Verification to do before classroom use

- Reference-check all lab values and ranges (bovine and human), fluid compositions, and correction-rate guidance.
- Teacher play-through for accuracy and tone. Engine tests confirm behavior matches the stated model. A "Model limits" card lists the simplifications.
