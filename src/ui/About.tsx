import type { RefObject } from 'preact';

export function About({ dialogRef }: { dialogRef: RefObject<HTMLDialogElement> }) {
  return (
    <dialog ref={dialogRef} class="about" aria-labelledby="about-title">
      <form method="dialog">
        <h2 id="about-title">About this case and its model</h2>
        <p>
          An original teaching simulation for high school biology. Juniper is a fictional calf. This activity is not
          affiliated with ExploreLearning or any commercial product.
        </p>
        <h3>Model limits: what is simplified</h3>
        <ul>
          <li>The body is modeled as two compartments: whole-body water (which sets blood sodium) and brain cells. Real bodies have many more.</li>
          <li>Water levels in the membrane mini-lab show the average behavior of a real solution. The moving dots are a small sample of molecules that wander at random and cross both ways. In the brain view, the net direction comes from the physiology model.</li>
          <li>The "barrier" combines the blood–brain barrier and brain cell membranes. In real brains, aquaporin-4 channels sit mostly on astrocytes (support cells), and those swell first.</li>
          <li>Seizures start when skull pressure passes 25 mmHg and stop at or below 20 mmHg. These are <em>rules of the model</em>. Low sodium also affects neurons directly.</li>
          <li>The effect of each IV bag on blood sodium uses a standard estimate (change ≈ (fluid Na − blood Na) ÷ (body water + 1 L)). The model ignores urine output and ongoing diarrhea.</li>
          <li>Overcorrection is flagged when sodium rises more than 10 mEq/L. Real guidelines vary (often 8–12 mEq/L in 24 h).</li>
          <li>Cell swelling in the pictures is exaggerated so it can be seen.</li>
          <li>Lab ranges are cattle reference intervals (Cornell Animal Health Diagnostic Center). Young calves can differ.</li>
        </ul>
        <h3>Sources used to check the numbers</h3>
        <ul class="small">
          <li>Cornell AHDC, bovine chemistry reference intervals: vet.cornell.edu</li>
          <li>Calf case report of hyponatremia with neurological signs: PMC5606621</li>
          <li>Exercise-associated hyponatremia guidance (Wilderness Medical Society, summarized in Am Fam Physician 2021;103(4):252)</li>
        </ul>
        <h3>Credits</h3>
        <p class="small">
          The look of the molecule simulations (ball-and-stick water, charged ions, water squeezing through the lipid
          bilayer, and a headcount of water on each side) was inspired by{' '}
          <a href="https://kodolab.org" target="_blank" rel="noopener">Kodolab (kodolab.org)</a>. No Kodolab code or images
          are used. This app's code is original.
        </p>
        <h3>Privacy</h3>
        <p>
          No accounts, no tracking, no analytics. Answers are saved only in this browser (localStorage) so a reload doesn't
          lose work. Nothing is sent anywhere unless you copy or download your report yourself.
        </p>
        <button class="primary" value="close">Close</button>
      </form>
    </dialog>
  );
}
