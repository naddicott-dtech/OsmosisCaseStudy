# Osmosis Case Study

An original, browser-based case study for high school Biology (Marathon Runner unit). Students play a veterinarian treating **Juniper**, a 3-week-old Holstein calf with seizures. They examine her, read her labs, watch water move into her brain by osmosis, and build the cause-and-effect chain. Then they choose an IV treatment, predicting the result before they see it, and apply the same reasoning to a marathon runner with exercise-associated hyponatremia.

**Live site:** https://naddicott-dtech.github.io/OsmosisCaseStudy/

Not affiliated with ExploreLearning or any commercial product. The molecule visuals were inspired by [Kodolab](https://kodolab.org). No Kodolab code or images are used.

## Classroom use (about 45–60 min)

| Step | Students… | Purpose tag |
|---|---|---|
| 1 Intake | Read the owner's well-meaning but misguided account (with false clues: a horse blanket, a bump on the head) and propose two possible causes | Engage |
| 2 Exam & Labs | Use exam tools (including a head check that rules out the false clue), flag 8 lab values against reference ranges, interpret | Practice |
| 3 Inside the Brain | Predict, then watch water cross BOTH through aquaporins and straight through the lipid bilayer as blood sodium falls; live tallies of water into and out of the brain | Predict / Practice |
| 4 Mini-labs | Membrane chamber with preset solutions (bilayer only / aquaporins / leaky), where net water flow emerges from a headcount of water at the membrane; red blood cell in a beaker (with plant-cell comparison); water potential calculator (**required for Honors, optional for others**) | Practice / Honors |
| 5 Causal Chain | Order 6 cards and reject 5 misconception and false-clue cards; feedback distinguishes wrong order from a missing link | Check |
| 6 Treatment | Trials of up to 4 IV rounds: choose fluid and dose, predict, watch the IV, reassess; each trial is scored (seizures stopped, safe first-day rise, no harmful fluid); move on after a safe stabilization or 3 trials; reflect | Check |
| 7 Report | Copy, download, or print the report and submit to Canvas | |

- **Submission:** students click **Copy report** and paste it into a Canvas text entry, or upload the downloaded `.txt`. The report records first attempts (first lab-flag score, first chain attempt, each treatment prediction, first runner treatment choice) as well as final answers.
- **Privacy:** no accounts, analytics, or network requests. Work is saved in the student's browser (localStorage) and survives reloads on the same device. A student who switches devices starts over, so stay on one Chromebook.
- **Accessibility:** keyboard-operable throughout (no drag-only interactions). Screen-reader labels on gauges, canvases, and charts. **Reduce motion** toggle (also follows the OS setting) stops the tremor animation, particle motion, and scrolling traces. No flashing content.
- **Written answers** pass a local "did thinking happen?" check: real words, enough distinct words, sentences, no filler like `aaaa` or keyboard mashing, not just parroting the question, and at least one topic word. It is a speed bump, not a grader. Fluent nonsense still passes. A model-based check is planned for a later hosted (Replit) edition.
- **Runner transfer case: hidden** (`ENABLE_RUNNER = false` in `src/content/case.ts`) because it previews the Marathon Runner performance task too closely. The planned replacement is a reverse-direction case (hypernatremia, e.g. drinking seawater).
- Steps can be revisited in any order from the step bar. In-page buttons lead students through in order.

## Development

```bash
npm install
npm run dev          # http://localhost:5173/OsmosisCaseStudy/
npm test             # engine unit tests (Vitest)
npm run test:browser # full student flow on Chromebook + phone viewports (Playwright)
npm run build
```

Pushing to `main` deploys to GitHub Pages via `.github/workflows/pages.yml`.

- `src/engine/`: pure, deterministic model code (physiology, membrane chamber, cell tonicity). No DOM.
- `src/engine/membrane.ts`: shared molecule world (mini-lab and brain view).
- `art/`: Blender script that renders the calf (see art/README.md). Web copies are in `public/art/`.
- `src/content/case.ts`: all case text, lab values, chain cards, feedback. Edit wording here.
- `src/ui/`: Preact screens and widgets. `src/report.ts` builds the student report.

See [MODEL.md](MODEL.md) for the science model, its simplifications, and sources, and [PLAN.md](PLAN.md) for design history and future work.
