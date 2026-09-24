# Osmosis Case Study: plan

This is the single source of truth for status, decisions, and next work on this repo. The curriculum workspace outside this repo only points here. Updated 2026-09-23. For how to code here, see CLAUDE.md. For classroom use, see README.md. For the science and its sources, see MODEL.md.

## 1. Status

| | |
|---|---|
| Live | https://naddicott-dtech.github.io/OsmosisCaseStudy/ (public GitHub Pages, deploys on push to `main`) |
| Juniper case | v1 complete; first classroom use planned for 2026-09-24 (Marathon Runner unit, teacher Unit 2) |
| Runner transfer page | Built but **hidden** (`ENABLE_RUNNER = false`) |
| Salmon case | **Planned, not started** (§4) |
| Analytics / hosted edition | Deferred (§5) |
| Canvas | No changes made. Neal creates the assignment, and students paste or upload their report |
| Classroom observations | First period 2026-09-24 (§6) |
| Unreleased work | One line of commits, no merges. `ship-now` = safe fixes, ready to deploy. `after-cohort` = stacked on top, waits until this semester's cohort finishes. See "Release workflow" below |

### Release workflow (decided 2026-09-24)

Neal dislikes resolving merge conflicts, so unreleased work stays on **one straight line of commits**, ordered by when it should ship:

```
main (live) ── ship-now ── after-cohort
```

- **Deploy** by fast-forwarding `main` to a branch tip: `git push origin ship-now:main`. It never merges, so it can't conflict. If it's refused as non-fast-forward, stop and ask.
- **New work** goes on the branch matching its risk: safe, high-value changes on `ship-now`, and quality-of-life changes on `after-cohort`. After committing to `ship-now`, rebase `after-cohort` onto it. The assistant resolves any conflicts; Neal shouldn't have to.
- **While a cohort is mid-case**, ship only changes that are very likely safe, a big improvement, and don't change what students must do or how saved progress is stored.

## 2. Decisions log

Teacher decisions (Neal) are marked **N**. Assistant defaults that Neal accepted are marked **A→N**.

- 2026-09-23 **N**: Build an original activity in place of ExploreLearning's "Osmosis" Gizmo. Host on GitHub Pages now; Replit later for analytics.
- 2026-09-23 **N**: Needed for class 2026-09-24, "non-analytics but production ready."
- 2026-09-23 **A→N**: The patient is Juniper, a 3-week-old Holstein heifer bottle calf.
- 2026-09-23 **N**: The history is well-meaning but misguided amateur care. Diarrhea is the *symptom* that led the owner to "rehydrate" with plain water and stop milk. There are false clues (horse blanket, bump on the head).
- 2026-09-23 **N**: Water potential is **required for Honors, optional for everyone else** (there's an "I'm in Honors" checkbox).
- 2026-09-23 **N**: The cattle reference ranges (Cornell AHDC) and a first-day sodium correction limit of about 10 mEq/L are fine.
- 2026-09-23 **N**: Water must visibly cross the lipid bilayer, not only aquaporins. The mini-lab levels must not oscillate.
- 2026-09-23 **N**: Borrow Kodolab's visual ideas with attribution (kodolab.org). No Kodolab code: it is AGPL-3.0, and adopting it would mean relicensing this repo, which Neal has not decided.
- 2026-09-23 **N**: The calf is rendered in Blender, in a comic-book style. Seizures are shown in episodes (tonic arch, then clonic paddling), not continuous "swimming."
- 2026-09-23 **N**: Exam tools open close-up pictures. The blood tube label reads "Juniper 9/24/26" (a fixed date, by request).
- 2026-09-23 **N**: Treatment must make clear that multiple rounds are allowed. This became trials of up to 4 rounds with a goal card and scorecard.
- 2026-09-23 **N**: Answer checks stay **loose**: false negatives are worse than students padding answers. Only obvious filler is blocked.
- 2026-09-23 **N**: **Hide the runner page.** It previews the Marathon Runner performance task (PT) too closely, like the previous unit's "mad libs" scaffold.
- 2026-09-23 **N**: The next case is **salmon osmoregulation**, as a separate page in this repo (§4). The reverse-hypernatremia idea is not used (hypernatremia in runners is real, but too close to the PT).
- 2026-09-23 **N**: Both cases in one class period is too much. Salmon is offered from Juniper's report as a small optional link, not a required step.
- 2026-09-24 **N**: Water molecules must read as H₂O, not "a red dot" (the top student request). Grey hydrogens now sit on top of the red oxygen ("Mickey Mouse"). Held off `main` while classes are mid-case.
- 2026-09-24 **N**: Changes from reviewing the first period's 14 submissions (branch `ship-now`):
  - Once the goal is met, the scorecard's main button goes to the final question, and another trial is labeled optional. Several students ran 4 to 7 trials after succeeding in trial 1.
  - A round that lowers sodium is labeled "worse" or "setback", never "Seizures stop". D5W after stabilizing had been reported as a success.
  - The report prints the final chain. Students referred to links by number, which the report didn't show. The chain prompt now asks students to name the link in words.
  - After 10 unsuccessful chain checks, show: "It seems like you may be having some trouble with this activity. If you're working on this in class, your teacher would be happy to help." Wording is Neal's.
  - A cell-lab note says brain cells swell against the skull but don't burst like red blood cells. Four students wrote that her brain cells burst.
- 2026-09-24 **N**: Honors water potential is split into three parts (branch `after-cohort`): a blood Ψs calculation, a brain-cell Ψs calculation, and a direction dropdown with a blank default. Juniper's values are a fixed table, so answers can be checked. The arrow calculator is now an optional sandbox that starts at non-Juniper values and doesn't affect grading. The worked example no longer uses Juniper's numbers. Earlier answers to the old single prompt still count. Later idea: a randomized practice problem with values that are easy to work with, like 27 °C (300 K) and multiples of 0.05 mol/L, recorded in the report.

## 3. What exists (Juniper case)

Flow: Intake → Exam & Labs → Inside the Brain → Mini-labs → Causal Chain → Treatment → Report (about 45–60 min).

- **Evidence captured in the report:**
  - first hypothesis
  - first lab-flag score
  - brain prediction (right or wrong)
  - first causal-chain attempt and number of checks
  - every treatment round's prediction and reason
  - trial verdicts
  - written answers
- **Treatment:** each trial is up to 4 rounds (about the first day). It ends automatically on overcorrection or a harmful fluid, and gets a scorecard (seizures stopped, first-day rise ≤ 10, no harmful fluid). To move on, a student needs one safe stabilization or 3 trials.
- **Evidence limits:** the report is self-reported text from an unsupervised browser. It shows engagement and reasoning attempts; it does not verify authorship. The answer check is a speed bump only.

**Juniper backlog** (not scheduled; ask Neal before doing):
- **Salmon link:** add the optional extension link at the end of the Report page once Salmon exists.
- **Skin-tent picture:** add a skin-tent inset to the eye close-up (the finding is currently text only).
- **Label date:** make the blood-tube date dynamic, if Neal reuses the case on other dates.
- **Tremor animation:** add eye-flick (nystagmus) or eyelid frames; the current tremor is subtle.
- **Runner page:** keep it hidden. Delete it or repurpose its data format for Salmon (§4) once Salmon ships.

## 4. Next: Salmon case (`salmon.html`)

### Purpose
1. **Optional extension**, linked from Juniper's report: *"Want to practice your understanding? Explore how salmon survive in both fresh water and salt water."*
2. **PT retake "ticket" or test correction:** students complete it in class, ideally with GoGuardian limited to one tab, to earn a retake or correction. It gives fresh practice of the PT's *reasoning skills* in a different system, so fewer students need to retake the Marathon Runner task itself.
3. **Scope:** about 25–35 minutes. Never required alongside Juniper in the same period.

### Learning targets
- Predict the direction of net water movement between a fish and its environment from relative solute concentration (fresh water: water in; seawater: water out).
- Explain why osmosis alone can't keep a fish's blood balanced, and how **active transport** does it. Gill ionocytes use Na⁺/K⁺-ATPase to pull salt IN in fresh water and pump it OUT in seawater, which costs energy (ATP).
- Relate kidney output to the environment: lots of dilute urine in fresh water, little urine in seawater, and drinking seawater at sea.
- Interpret a data set against normal ranges, build a causal chain, say what's still working, and explain a secondary effect. These are the same *skills* as the PT, applied to different content.

### Architecture
- **Two pages from one build.** Vite multi-page: `index.html` (Juniper) plus `salmon.html`. Add `build.rollupOptions.input` in vite.config.ts.
- **Uppercase URL.** GitHub Pages is case-sensitive. Add a tiny `Salmon.html` that redirects to `salmon.html`, so both URLs Neal might share work.
- **Shared code:** `src/engine/membrane.ts` (add an **active pump route**: ions moved against their gradient at a set rate, costing "ATP"), `src/ui/molrender.ts`, `src/quality.ts`, `src/state.ts` (make the storage key a parameter), the report builder pattern, widgets, and styles.
- **New code:** `src/salmon/` (entry, screens, content file) and `src/engine/fish.ts`, a pure model with tests. For the fish model:
  - **State:** plasma osmolality (normal about 300–340 mOsm/kg), body water, environment osmolality (fresh water about 0–10; seawater about 1000–1100).
  - **Water across gills and skin:** flux ∝ (plasma osm − environment osm) × permeability.
  - **Ions:** passive leak down the gradient, plus the active pump. Its direction depends on the ionocyte type, which the student controls; the pump costs energy.
  - **Drinking and kidney:** drinking (on or off) and urine volume/concentration settings.
  - **Goal:** keep plasma osmolality in range across life stages.
  - **Every number** must be reference-checked before use (§4 verification).
- **Separate localStorage key** (`osmosis-salmon-v1`), so a Salmon retake never touches Juniper progress on a shared Chromebook.
- **Same report format** (copy / download / print), with a header naming the Salmon case and optional retake/correction wording.

### Draft flow
1. **Hatchling in the river (Engage → Predict → Observe).** Predict water direction, then watch in the membrane view (gill cell | river). Water floods in and salt leaks out. Students use controls (gill pump direction and rate, urine output) to keep plasma in range.
2. **Smolt heading to sea (Predict → Practice).** The environment flips. Predict first, then the student must turn on drinking, switch the gill pumps to secrete salt, and cut urine output. Feedback targets misconceptions: "salt diffuses in so the fish gets saltier, that's fine"; "just drink more fresh water"; "fish don't drink."
3. **"Moved too fast" data case (Check; the core of the retake ticket).** A hatchery smolt was moved to seawater before its gills finished switching. The data table has normal ranges: plasma Na⁺ and osmolality high, body mass down, gill Na⁺/K⁺-ATPase activity low, maybe hematocrit up. Students flag values, write a causal chain, say what's still working, and give one secondary effect. **Less scaffolding than Juniper:** there's no simulation on this screen, and feedback names misconceptions without revealing answers. Written answers are the evidence.
4. **Adult returning to spawn (brief reverse check).** Predict and explain the switch back to freshwater mode. **Honors:** a water-potential comparison of blood versus river versus ocean (required for Honors, optional for others, as in Juniper).
5. **Report.**

### Evidence design (for retake/correction use)
- Keep first attempts (predictions, first flag score, first chain) in the report, as in Juniper.
- At least one **independent written explanation with no simulation support**, so the report shows what the student can explain on their own.
- Loose answer check (the same policy as Juniper).
- Monitored in-class completion (GoGuardian) is Neal's integrity layer; the app does not try to prove authorship.

### Open decisions (ask Neal before building)
1. **Rubric alignment:** should the Check prompts map to the PT rubric or outcome criteria (CI1 structure/function, levels 2–4)? If so, get the criteria from Neal. Don't guess the PT permutations.
2. **Honors:** water potential required for Honors in Salmon too? (Default: yes, matching Juniper.)
3. **Retake/correction framing:** does the report need a field or header for "PT retake ticket" versus "test correction" versus "extension"? No names are stored; Canvas identifies the student.
4. **Species and story:** a specific salmon (e.g. coho or Atlantic), a named hatchery fish, and whether to include a hatchery-worker narrator (parallel to Dana).
5. **Art:** Blender renders in the calf's comic style (fish at three life stages, gill close-up), or simpler canvas art.

### Verification before classroom use
- Reference-check freshwater/seawater osmolality, typical salmonid plasma Na⁺/osmolality ranges, smolt transfer-stress values, and the roles of gill Na⁺/K⁺-ATPase and ionocytes (primary sources or university fisheries references). Record them in MODEL.md with sources.
- Engine tests: water direction flips with the environment; pump direction must match the environment to stay in range; a "too fast" transfer produces the data-case pattern.
- Playwright flow at Chromebook and phone sizes; reduce-motion; no horizontal scroll; performance under 6× CPU throttle.
- A teacher play-through.

### Acceptance checks
- `salmon.html` and `Salmon.html` both load on the live site. Juniper is unaffected (its tests pass).
- A full student run completes in 35 minutes or less; the report copies cleanly and shows first attempts.
- Juniper's report shows the optional Salmon link and is never blocked by it.

## 5. Later: hosted edition (Replit)
- **Optional analytics:** anonymous or pseudonymous student-response analytics. This needs a separate privacy design first. Follow the Biology workspace privacy rules: no identifiers in model context, and screening before any model review.
- **Model-based answer check:** an API key held server-side, never in the static site. Keep the loose-false-negative policy.
- **No commitments yet.**

## 6. Classroom observations
_None yet. Record dated, teacher-reported observations here (what confused students, timing, bugs), kept separate from assistant interpretation._

- 2026-09-24, first period: students read the water sprite as a single red dot (hydrogens were hidden). Writing a reason for every treatment round felt repetitive and frustrating, given how many rounds students try.

## 7. History and design rationale

**v1 (2026-09-23 morning).** Built from a pasted description of the Gizmo. Science corrections made to that description:

| Pasted spec | Problem | What we did |
|---|---|---|
| "Diarrhea → sodium loss → hypotonic blood" | Diarrhea loses water *and* sodium; blood goes hypotonic when the losses are replaced with plain water | Owner gives plain water and stops milk |
| Diarrhea with normal K⁺ | Calf diarrhea often causes acidosis and high K⁺ | High K⁺, low HCO₃⁻, high PCV and BUN in the labs |
| Pure water IV option | Never given IV; causes hemolysis | Labeled thought experiment; D5W is the real "free water" option |
| Normal saline "doesn't work" (hard-coded) | 154 mEq/L is higher than 110; it raises Na⁺ slowly | Outcomes computed from concentrations |
| Hypertonic saline → "cured" | Too-fast correction causes osmotic demyelination | First-day limit and overcorrection verdict |
| "Semi-permeable = aquaporin only," with O₂ | O₂ crosses the lipid itself | Bilayer / aquaporin / leaky modes |
| Hypotonic → "turgor" | Turgor is a plant-cell idea | Animal cell lyses; plant toggle shows turgor |
| Endothelial aquaporins, neurons swell | AQP4 is on astrocytes, which swell first | Stated in model limits |
| Seizure = ICP > 25 | A model rule | Labeled as a model rule |

**v2 (2026-09-23).** Emergent membrane simulation (macro levels plus molecule sample) and bilayer crossings in the brain view. Also: the chain grader bug (a missing link was reported as "out of order"), the narrative rewrite with false clues and head exam, the answer check, IV visuals, the Blender calf, and Honors labeling.

**v3 (2026-09-23 evening).** Seizure episodes from an overhead camera; exam close-ups; treatment as trials with rounds and scorecards; "still needed" hints on disabled buttons; looser answer check; runner page hidden; tallies reset per round.

**Why the membrane model has two layers.** Particle-only water levels wandered about ±3% at any particle count a Chromebook can afford. That's real statistics for a few hundred molecules, but it read as broken. The levels now follow the average behavior. The dots are a sample that crosses both ways and is steered only enough to stay in step. MODEL.md explains this to curious teachers.
