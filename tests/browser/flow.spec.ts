import { expect, test, type Page } from '@playwright/test';

const SENTENCE = 'Water moves toward the side with more dissolved solute, so by osmosis it moves into the brain cells and they swell.';
const ANSWERS: Record<string, string> = {
  intake: 'It could be low sodium from all the water she drank, or a head injury from the gate. A blood test and a head exam would help tell these apart.',
  systems: 'Her temperature is normal and her glucose is in the normal range, so her energy supply and temperature control still work.',
  link: 'Her sodium is very low at 110 because she drank lots of plain water after losing salt in the diarrhea.',
  treatment: 'Hypertonic saline raises blood sodium a little, so the blood is saltier than the brain cells and water moves out of the swollen brain by osmosis.',
  runnerChain: 'The runner drank too much plain water, so their blood sodium became diluted and hypotonic. By osmosis water moved into the brain cells, which swelled and caused confusion and a seizure.',
  ruleout: 'Their temperature was a normal 37.4 so heat stroke is unlikely, and their glucose was 98 which is normal, so it is not low blood sugar.',
  unknown: 'We do not know how much sodium they lost in sweat, so I would want to measure their sweat and urine sodium next.',
};
const shots = process.env.SHOTS === '1';

async function shot(page: Page, name: string) {
  if (shots) await page.screenshot({ path: `test-results/shots/${test.info().project.name}-${name}.png`, fullPage: true });
}

async function fill(page: Page, labelPart: string | RegExp, text: string = SENTENCE) {
  await page.getByLabel(labelPart).fill(text);
}

test('a student can complete the whole case and export a report', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);

  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Intake: meet your patient' })).toBeVisible();
  await shot(page, '1-intake');
  await fill(page, /list TWO possible causes/i, ANSWERS.intake);
  await page.getByRole('button', { name: /Examine Juniper/ }).click();

  // Exam & labs
  for (const t of ['Thermometer', 'Stethoscope', 'Skin tent & eyes', 'Head & eyes check', 'Blood sample']) {
    await page.getByRole('button', { name: new RegExp(t) }).click();
    const card = page.getByRole('dialog');
    await expect(card).toBeVisible();
    await expect(card.getByRole('heading', { name: t })).toBeVisible();
    if (t === 'Thermometer') {
      await expect(card.locator('text.lcd-text')).toHaveText('38.9 °C');
      await shot(page, '2-exam-thermometer');
    }
    if (t === 'Blood sample') {
      await expect(card.locator('text.label-text').first()).toHaveText('Juniper');
      await shot(page, '2-exam-blood');
    }
    if (t === 'Skin tent & eyes') await shot(page, '2-exam-eye');
    await card.getByRole('button', { name: 'Close' }).click();
    await expect(card).toBeHidden();
  }
  const flags: Record<string, string> = {
    na: 'low', cl: 'low', k: 'high', hco3: 'low', glu: 'normal', bun: 'high', pcv: 'high', osm: 'low',
  };
  // Deliberately get one wrong first to exercise feedback.
  await page.locator('#lab-na-normal').click();
  for (const [id, f] of Object.entries(flags)) if (id !== 'na') await page.locator(`#lab-${id}-${f}`).click();
  await page.getByRole('button', { name: 'Check my flags' }).click();
  await expect(page.getByText('7 of 8 correct')).toBeVisible();
  await page.locator('#lab-na-low').click();
  await page.getByRole('button', { name: 'Check my flags' }).click();
  await expect(page.getByText('All flags correct.')).toBeVisible();
  await shot(page, '2-exam');
  await fill(page, /Which body systems look like/, ANSWERS.systems);
  await fill(page, /Which abnormal value/, ANSWERS.link);
  await page.getByRole('button', { name: /Look inside the brain/ }).click();

  // Brain
  await page.getByRole('button', { name: 'From the blood into the brain' }).click();
  await page.getByRole('button', { name: /Play: Juniper drinks plain water/ }).click();
  await page.waitForTimeout(1500);
  await shot(page, '3-brain-running');
  await page.getByRole('button', { name: 'Skip to end' }).click();
  await expect(page.getByText('Seizure zone').first()).toBeVisible();
  await fill(page, /why does more water move into the brain/i);
  await page.getByRole('button', { name: /Go to the mini-labs/ }).click();

  // Mini-labs: default preset is salt water | pure water with aquaporins.
  await page.getByRole('button', { name: 'Skip ahead 30 s' }).click();
  await expect(page.getByText('The LEFT side has risen.')).toBeVisible();
  await page.getByRole('radio', { name: /Lipid bilayer only/ }).check();
  await page.getByRole('button', { name: 'Skip ahead 30 s' }).click();
  await shot(page, '4-membrane');
  await fill(page, /Start with "Salt water/);
  await page.getByRole('tab', { name: /Cell in a beaker/ }).click();
  const slider = page.getByRole('slider');
  await slider.fill('0.2');
  await expect(page.getByText('burst (lysed)')).toBeVisible();
  await slider.fill('3');
  await expect(page.getByText('shrunken (crenated)')).toBeVisible();
  await slider.fill('0.9');
  await expect(page.getByText('You found all three')).toBeVisible();
  await shot(page, '4-cell');
  await fill(page, /Describe what happened to the red blood cell/);
  await page.getByRole('tab', { name: /Water potential/ }).click();
  await expect(page.getByText(/Honors: required/).first()).toBeVisible();
  // Honors: two calculations, then a direction from a blank dropdown (readout hidden until chosen).
  await page.getByLabel("I'm in Honors Biology").check();
  await expect(page.getByRole('button', { name: /Build the causal chain/ })).toBeDisabled();
  // Juniper's values are fixed; the arrow calculator is a separate sandbox that can't change grading.
  await expect(page.getByRole('row', { name: /Blood \(NaCl-equivalent\) 0\.110 mol\/L/ })).toBeVisible();
  await page.getByText('Calculator: try other values').click();
  await page.getByLabel('Solution outside the cell (NaCl)').fill('0.3');
  await expect(page.getByText('from the cell → outside')).toBeVisible();
  await page.getByLabel(/Calculate Ψs for Juniper's BLOOD/).fill('Ψs = (2)(0.110)(0.0831)(312.05) = 5.70 bar');
  await expect(page.getByText(/solute potential is never positive/)).toBeVisible();
  await page.getByLabel(/Calculate Ψs for Juniper's BLOOD/).fill('Ψs = −(2)(0.110)(0.0831)(312.05) = −5.70 bar');
  await expect(page.getByText(/solute potential is never positive/)).toHaveCount(0);
  await page.getByLabel(/Calculate Ψs for her BRAIN CELLS/).fill('Ψs = −(2)(0.145)(0.0831)(312.05) = −7.52 bar');
  await expect(page.getByLabel(/which way does water move/)).toHaveValue('');
  await page.getByLabel(/which way does water move/).selectOption({ label: 'From her brain cells into her blood' });
  await expect(page.getByText(/Check the signs/)).toBeVisible();
  await page.getByLabel(/which way does water move/).selectOption({ label: 'From her blood into her brain cells' });
  await expect(page.getByText(/That is why her brain cells swell/)).toBeVisible();
  await page.getByRole('button', { name: /Build the causal chain/ }).click();

  // Chain: include a distractor first.
  await page.getByRole('button', { name: /Sodium ions move from the blood into the brain/ }).click();
  await page.getByRole('button', { name: 'Check my chain' }).click();
  await expect(page.getByText(/cannot cross the blood–brain barrier quickly/)).toBeVisible();
  await page.getByRole('button', { name: 'Remove link 1' }).click();
  for (const start of ['Diarrhea removes', 'Trying to rehydrate', 'Blood sodium falls', 'By osmosis', 'Brain cells swell', 'Squeezed, swollen']) {
    await page.getByRole('button', { name: new RegExp(`^${start}`) }).click();
  }
  // Swap two links to test reordering feedback, then fix.
  await page.getByRole('button', { name: 'Move link 2 up' }).click();
  await page.getByRole('button', { name: 'Check my chain' }).click();
  await expect(page.getByText(/Links 1 and 2 are in the wrong order/)).toBeVisible();
  await page.getByRole('button', { name: 'Move link 1 down' }).click();
  // Remove a middle link: must say "missing", not "out of order".
  await page.getByRole('button', { name: 'Remove link 2' }).click();
  await page.getByRole('button', { name: 'Check my chain' }).click();
  await expect(page.getByText(/missing between them/)).toBeVisible();
  await page.getByRole('button', { name: /^Trying to rehydrate her/ }).click();
  await page.getByRole('button', { name: 'Move link 6 up' }).click();
  for (let i = 5; i >= 3; i--) await page.getByRole('button', { name: `Move link ${i} up` }).click();
  await page.getByRole('button', { name: 'Check my chain' }).click();
  await expect(page.getByText(/Your chain is complete/)).toBeVisible();
  await shot(page, '5-chain');
  await fill(page, /Pick the ONE link/);
  await page.getByRole('button', { name: /Treat Juniper/ }).click();

  // Treatment: D5W (worse), then new trial with 500 mL 3% (success)
  const order = async (fluid: RegExp, vol: string, effect: RegExp) => {
    await page.getByLabel(fluid).check();
    await page.getByLabel(vol, { exact: true }).check();
    await page.getByLabel(effect).check();
    await page.getByLabel('Explain your prediction').fill('Because the sodium concentration in the blood will change.');
    await page.getByRole('button', { name: /Start IV/ }).click();
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: 'Skip to result' }).click();
  };
  await expect(page.getByText('Your goal: stop the seizures safely')).toBeVisible();
  await order(/D5W/, '1 L', /INTO the brain/);
  await expect(page.getByRole('heading', { name: /Round 1 result: Worse/ })).toBeVisible();
  await page.getByRole('button', { name: 'End trial 1 here' }).click();
  await expect(page.getByRole('heading', { name: 'Trial 1: Not stabilized' })).toBeVisible();
  await page.getByRole('button', { name: /Start trial 2/ }).click();
  await order(/Hypertonic saline/, '500 mL', /OUT of the brain/);
  await expect(page.getByRole('heading', { name: /Round 1 result: Seizures stop/ })).toBeVisible();
  await expect(page.getByText(/lying upright with her head raised/).first()).toBeVisible();
  await expect(page.locator('svg.calf .iv')).toHaveCount(1);
  await page.getByRole('button', { name: 'End trial 2 here' }).click();
  await expect(page.getByRole('heading', { name: 'Trial 2: Stabilized safely' })).toBeVisible();
  // Goal met: finishing is the main action; another trial is optional.
  await expect(page.getByText(/You've met the goal for this step/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Start trial 3 .*\(optional\)/ })).toHaveClass(/secondary/);
  await page.getByRole('button', { name: /Go to the final question/ }).click();
  await expect(page.getByLabel(/Explain why the treatment that worked/)).toBeFocused();
  await shot(page, '6-treat');
  await fill(page, /Explain why the treatment that worked/, ANSWERS.treatment);
  await page.getByRole('button', { name: /Finish and make my report/ }).click();

  // Report
  await expect(page.getByText('All sections complete.')).toBeVisible();
  await page.getByRole('button', { name: /Copy report/ }).click();
  await expect(page.getByText(/Copied!|Copy was blocked/)).toBeVisible();
  const reportText = await page.locator('#report-text').innerText();
  expect(reportText).toContain('D5W');
  expect(reportText).toContain('Trial 2 result (1 round): Stabilized safely');
  expect(reportText).not.toContain('Runner case');
  expect(reportText).toContain('Lab flags first check: 7/8');
  expect(reportText).toContain('Final (solved) chain:');
  expect(reportText).toContain('A: From her blood into her brain cells (correct). First choice: From her brain cells into her blood');
  expect(reportText).toContain('= −7.52 bar');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Download/ }).click();
  expect((await download).suggestedFilename()).toMatch(/osmosis-case-report-.*\.txt/);
  await shot(page, '8-report');

  // Completed-step markers must not widen the page on phones.
  const vw = page.viewportSize()!.width;
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(vw);

  // Progress survives a reload.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your report' })).toBeVisible();
  await expect(page.locator('#report-text')).toContainText('Stabilized safely');

  expect(errors).toEqual([]);
});

test('reduced motion mode renders without animation loops or errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await expect(page.getByLabel('Reduce motion')).toBeChecked();
  for (const name of ['Inside the Brain', 'Mini-labs', 'Treatment']) {
    await page.getByRole('button', { name: new RegExp(name) }).first().click();
    await expect(page.locator('main canvas').first()).toBeVisible();
  }
  const animated = await page.evaluate(() =>
    [...document.querySelectorAll('.calf *')].filter((el) => getComputedStyle(el).animationName !== 'none').length);
  expect(animated).toBe(0);
  expect(errors).toEqual([]);
});

test('overcorrection ends a trial automatically', async ({ page }) => {
  await page.goto('./');
  await page.locator('.stepper button').nth(5).click();
  await page.getByLabel(/Hypertonic saline/).check();
  await page.getByLabel('1 L', { exact: true }).check();
  await page.getByLabel(/OUT of the brain/).check();
  await page.getByLabel('Explain your prediction').fill('Because the saline raises blood sodium a lot.');
  await page.getByRole('button', { name: /Start IV/ }).click();
  await page.getByRole('button', { name: 'Skip to result' }).click();
  await expect(page.getByRole('heading', { name: 'Trial 1: Trial over: sodium rose too fast' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Start IV/ })).toHaveCount(0);
});

test('mini-lab gate says what is missing and jumps to it (Honors)', async ({ page }) => {
  await page.goto('./');
  await page.locator('.stepper button').nth(3).click();
  await page.getByLabel("I'm in Honors Biology").check();
  const hint = page.locator('.gate-hint');
  await expect(hint).toContainText('Lab 1 explanation');
  await expect(hint).toContainText('Lab 3 water potential (Honors)');
  await hint.getByRole('button', { name: 'Lab 3 water potential (Honors)' }).click();
  await expect(page.getByRole('tab', { name: /Water potential/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByLabel(/Calculate Ψs for Juniper's BLOOD/)).toBeFocused();
});

test('after many unsuccessful chain checks, suggest asking the teacher', async ({ page }) => {
  await page.goto('./');
  await page.locator('.stepper button').nth(4).click();
  await page.getByRole('button', { name: /^Brain cells swell/ }).click();
  await page.getByRole('button', { name: /^Diarrhea removes/ }).click();
  const help = page.getByText(/your teacher would be happy to help/);
  for (let i = 0; i < 9; i++) await page.getByRole('button', { name: 'Check my chain' }).click();
  await expect(help).toHaveCount(0);
  await page.getByRole('button', { name: 'Check my chain' }).click();
  await expect(help).toBeVisible();
});

test('filler answers are rejected', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel(/list TWO possible causes/i).fill('a'.repeat(120));
  await expect(page.getByRole('button', { name: /Examine Juniper/ })).toBeDisabled();
  await page.getByLabel(/list TWO possible causes/i).fill('asdf asdf asdf asdf asdf asdf asdf asdf asdf asdf asdf asdf asdf');
  await expect(page.getByRole('button', { name: /Examine Juniper/ })).toBeDisabled();
  await page.getByLabel(/list TWO possible causes/i).fill(ANSWERS.intake);
  await expect(page.getByRole('button', { name: /Examine Juniper/ })).toBeEnabled();
});

test('no horizontal page scroll', async ({ page }) => {
  await page.goto('./');
  const n = await page.locator('.stepper button').count();
  for (let i = 0; i < n; i++) {
    await page.locator('.stepper button').nth(i).click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `step ${i + 1}`).toBeLessThanOrEqual(1);
  }
});
