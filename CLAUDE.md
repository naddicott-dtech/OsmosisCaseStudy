# OsmosisCaseStudy: agent guide

A static teaching web app for high school Biology: students treat Juniper, a calf with seizures from low blood sodium (hyponatremia). Live at https://naddicott-dtech.github.io/OsmosisCaseStudy/. Repo: github.com/naddicott-dtech/OsmosisCaseStudy. The owner and teacher is Neal. Updated 2026-09-23.

**Start with PLAN.md.** It is the single source of truth for status, the decisions log (what Neal decided and when), the Salmon case spec, open decisions, and classroom observations. Update it when you change status or record a decision.

## Scope for agents working here

- **This folder is its own git repo.** It sits inside a Biology curriculum workspace (the parent folder), which holds unrelated curriculum files and private student records. **Do not read, search, or modify anything outside this folder** unless Neal explicitly asks. The parent's AGENTS.md is about that curriculum workspace; for app work, this file is the guide. To avoid inheriting the parent context entirely, clone the repo somewhere else.
- **The app collects no student data:** no accounts, analytics, or network calls. Answers stay in the browser's localStorage and students copy/download a text report into Canvas. Keep it that way unless Neal asks (a hosted Replit edition with analytics is a possible future step, needing its own privacy design).
- **Pushing to `main` deploys to GitHub Pages** (public). Commit and push only when asked, or as part of an explicitly requested deploy. Never push student data or anything from the parent folder.

## Commands

```bash
npm install
npm run dev            # http://localhost:5173/OsmosisCaseStudy/
npm test               # Vitest engine tests (tests/engine)
npm run test:browser   # Playwright: full student flow at 1366×768 (Chromebook) and Pixel 7
npm run build          # tsc -b && vite build (base '/OsmosisCaseStudy/')
SHOTS=1 npx playwright test   # also writes screenshots to test-results/shots/
```

To test the live site, run Playwright with `baseURL` https://naddicott-dtech.github.io/OsmosisCaseStudy/ (copy playwright.config.ts to a temp config).

## Stack and layout

Vite + TypeScript + Preact + @preact/signals. Canvas 2D for molecules. No UI framework. It mirrors Neal's Climate Farmer project conventions.

- `src/engine/`: pure, deterministic model code with no DOM. Unit-test anything here.
  - `physiology.ts`: two-compartment model (plasma Na and brain water/pressure), IV fluids, seizure thresholds, overcorrection, trial verdicts.
  - `membrane.ts`: the molecule world, used by the mini-lab and the brain view. **Two layers by design:** macro water levels (the smooth average behavior) plus a random-walk sample of about 350 dots, steered to stay in step. Water crosses through aquaporins AND the lipid bilayer. See the header comment and MODEL.md for why (particle-only levels jittered at Chromebook-affordable counts).
  - `cells.ts`: cell in a beaker (Boyle–van 't Hoff) and water potential.
- `src/content/case.ts`: **all student-facing text**, lab values, chain cards, feedback, and verdict text. Edit wording here, not in components. `ENABLE_RUNNER` (currently false) hides the runner transfer step.
- `src/quality.ts`: the local answer check. **Deliberately loose:** it blocks only obvious filler; length and topic words are tips. Neal prefers false positives to false negatives.
- `src/chain.ts`: causal-chain grading by relative order (a missing link is not "out of order").
- `src/state.ts`: one persisted signal (`saved`), with localStorage save on change and on page hide.
- `src/report.ts`: plain-text report and progress list.
- `src/ui/`: screens (`screens/*.tsx`), `molrender.ts` (cached sprites, bilayer drawing, a `frameLoop` with visibility pause and a 30 fps fallback), `BrainCanvas.tsx`, `Calf.tsx` (Blender frames, seizure episode timeline, IV overlay), `ExamCard.tsx` (exam close-up dialogs with text overlays).
- `art/`: Blender scripts (`calf.py`, `exam.py`), anchors JSON, and source PNGs. Web copies are in `public/art/*.webp`. Regenerate with `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python art/calf.py` (see art/README.md).
- Docs: PLAN.md (status, decisions, next work), README.md (classroom use), MODEL.md (science, simplifications, sources).

## Requirements that are easy to break

- **Chromebooks are the target.** Keep the molecule count around 350, sprites cached, animation loops going through `frameLoop`, and pixel ratio capped at 1.5. Check with CPU throttling if you add rendering work: the brain replay did about 45 fps at 6× throttle.
- **Accessibility:** no flashing (seizure frames differ only in pose). Every animation must honor the Reduce motion toggle and `prefers-reduced-motion`. Everything must be keyboard-operable with no drag-only interactions. Canvases and gauges need aria labels. Disabled buttons must say what is missing (`.gate-hint`).
- **No horizontal page scroll at phone width** (there's a Playwright test). Beware absolutely positioned elements inside scrolling containers; the `.sr-only` spans in the stepper once widened the page.
- **Science accuracy:** numbers are model rules, documented in MODEL.md. Don't change thresholds or fluid compositions without updating MODEL.md and the engine tests. Key facts:
  - 500 mL of 3% saline → safe stabilization; 1 L → overcorrection (>10 mEq/L first-day rise).
  - Normal saline alone → not enough.
  - D5W or sterile water → worse (sterile water also hemolysis).
- **Originality:** the app is inspired by, but must not copy, ExploreLearning's "Osmosis" Gizmo (text, art, names). The molecule visuals credit Kodolab (kodolab.org), which is AGPL-3.0 code and CC BY-NC content. **Do not copy Kodolab code or images** unless Neal decides to relicense this repo under the AGPL.
- **Playwright is pinned** to 1.58.2 to match the locally cached browsers. npm 11 can write a versionless `@napi-rs/lzma-linux-x64-gnu` entry into package-lock.json, which breaks `npm ci` on CI (npm 10). After any reinstall, strip lock entries without a `version`.

## Working style Neal expects

Concrete plan, small verified increments, tests plus proof of behavior (screenshots for visual work), plain explanations of tradeoffs, and honest limitations. Pedagogy first: predictions before simulations, evidence of reasoning (first attempts are kept in the report), misconception-specific feedback, and no single "click the right answer" paths.
