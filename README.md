# Osmosis Case Study

An original, browser-based case study for high school Biology (Marathon Runner unit). Students play a veterinarian treating **Juniper**, a 3-week-old Holstein calf with seizures. They examine her, read her labs, watch water move into her brain by osmosis, and build the cause-and-effect chain. Then they choose an IV treatment, predicting the result before they see it, and apply the same reasoning to a marathon runner with exercise-associated hyponatremia.

**Live site:** https://naddicott-dtech.github.io/OsmosisCaseStudy/

Not affiliated with ExploreLearning or any commercial product.

## Classroom use (about 45–60 min)

| Step | Students… | Purpose tag |
|---|---|---|
| 1 Intake | Read the history and write a first hypothesis | Engage |
| 2 Exam & Labs | Use exam tools, flag 8 lab values against reference ranges, interpret | Practice |
| 3 Inside the Brain | Predict, then watch water cross aquaporins as blood sodium falls; explain | Predict / Practice |
| 4 Mini-labs | Membrane chamber (bilayer / aquaporins / leaky); red blood cell in a beaker (with plant-cell comparison); optional water potential calculator | Practice / Extension |
| 5 Causal Chain | Order 6 cards and reject 4 misconception cards; explain one link | Check |
| 6 Treatment | Choose fluid and dose, predict, observe; can overcorrect; reflect | Check |
| 7 Runner Case | New data, no simulation: flag values, explain collapse, rule out alternatives, choose treatment | Check (transfer) |
| 8 Report | Copy, download, or print the report and submit to Canvas | |

- **Submission:** students click **Copy report** and paste it into a Canvas text entry, or upload the downloaded `.txt`. The report records first attempts (first lab-flag score, first chain attempt, each treatment prediction, first runner treatment choice) as well as final answers.
- **Privacy:** no accounts, analytics, or network requests. Work is saved in the student's browser (localStorage) and survives reloads on the same device. A student who switches devices starts over, so stay on one Chromebook.
- **Accessibility:** keyboard-operable throughout (no drag-only interactions). Screen-reader labels on gauges, canvases, and charts. **Reduce motion** toggle (also follows the OS setting) stops the tremor animation, particle motion, and scrolling traces. No flashing content.
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
- `src/content/case.ts`: all case text, lab values, chain cards, feedback. Edit wording here.
- `src/ui/`: Preact screens and widgets. `src/report.ts` builds the student report.

See [MODEL.md](MODEL.md) for the science model, its simplifications, and sources, and [PLAN.md](PLAN.md) for design history and future work.
