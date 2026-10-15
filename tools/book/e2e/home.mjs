// /book runs 12–13, from the staging walkthrough of 2026-10-15:
// a job the server offered to the home's Preferred Pro says so (no
// "Pick one", no stray "null"), and a browser on another clock books
// the home's day at the home's midnight.

import assert from 'node:assert/strict';
import { BASE, PAGE, reset, log, snap, fresh, describeAndSpeed, signUp, addHome } from './lib.mjs';

// ── Run 12: the home's Preferred Pro gets it first ─────────────────
{
  await reset();
  await fetch(`${BASE}/__preferred?on=1`);
  const { ctx, page } = await fresh({ timezoneId: 'UTC' });
  await page.goto(`${PAGE}&trade=plumbing`);
  await page.waitForSelector('.b-choice');
  await page.click('.b-choice:nth-child(2)'); // Clogged drain
  await describeAndSpeed(page, 'STANDARD', 'Kitchen sink drains slowly and gurgles.');
  await page.waitForSelector('[data-window]');
  await page.click('[data-day]:nth-child(2)');
  await page.click('[data-window=MIDDAY]');
  await page.click('[data-key=next]');
  await signUp(page);
  await addHome(page);
  await page.waitForSelector('[data-key=confirm]');
  await page.click('[data-key=confirm]');
  await page.waitForFunction(() => document.body.textContent.includes('Sent to your Preferred Pro'));
  await snap(page, 'done-preferred');
  const status = await page.textContent('.b-line');
  assert.equal(status, 'Sent to your Preferred Pro, Marcus. You’ll hear as soon as they accept. If they can’t take it this time, you’ll choose another pro in the app.');
  assert.ok(!(await page.textContent('#book')).includes('Pick one'), 'nobody is asked to pick');
  assert.equal(await page.$('[data-contractor]'), null, 'no pro to pick');
  let calls = await log();
  assert.ok(!calls.some((c) => c.path.endsWith('/select-contractor')), 'nothing picked for them');

  // Express to the Preferred Pro: theirs first, then the closest pro.
  await page.click('.b-inline'); // Book something else
  await page.waitForSelector('[data-trade=HVAC]');
  await page.click('[data-trade=HVAC]');
  await page.click('.b-choice');
  await describeAndSpeed(page, 'EXPRESS', 'Upstairs unit runs but blows warm air.');
  await page.waitForSelector('[data-property=p-1]');
  await page.click('[data-property=p-1]');
  await page.waitForSelector('[data-key=confirm]');
  await page.click('[data-key=confirm]');
  await page.waitForFunction(() => document.body.textContent.includes('Sent to your Preferred Pro'));
  await snap(page, 'done-preferred-express');
  assert.equal(await page.textContent('.b-line'), 'Sent to your Preferred Pro, Marcus. If they can’t take it in the next few minutes, the closest pro gets it. Watch it happen in the app.');
  calls = await log();
  assert.ok(!calls.some((c) => c.path.endsWith('/select-contractor')));

  // Without a Preferred Pro, Standard still asks the homeowner to pick.
  await fetch(`${BASE}/__preferred?on=0`);
  await page.click('.b-inline');
  await page.waitForSelector('[data-trade=ELECTRICAL]');
  await page.click('[data-trade=ELECTRICAL]');
  await page.click('.b-choice');
  await describeAndSpeed(page, 'STANDARD', 'Breaker for the kitchen trips every hour.');
  await page.waitForSelector('[data-window]');
  await page.click('[data-window=MORNING]');
  await page.click('[data-key=next]');
  await page.waitForSelector('[data-property=p-1]');
  await page.click('[data-property=p-1]');
  await page.waitForSelector('[data-key=confirm]');
  await page.click('[data-key=confirm]');
  await page.waitForSelector('[data-contractor=c-1]');
  await snap(page, 'done-pick-after-preferred');
  assert.match(await page.textContent('.b-line'), /Pick one/);
  console.log('✓ Preferred Pro: "Sent to your Preferred Pro, Marcus." with nothing to pick (Standard and Express); no Preferred Pro, the pick list as before; no stray null');
  await ctx.close();
}

// ── Run 13: a browser on Honolulu time books a home in Chicago ─────
// 06:30 UTC on Oct 16: 8:30 PM on Oct 15 in Honolulu, 1:30 AM on Oct 16
// at the home. The browser's "tomorrow" (Oct 16) is today at the home.
{
  const now = '2026-10-16T06:30:00Z';
  await reset();
  await fetch(`${BASE}/__now?t=${now}`);
  const { ctx, page } = await fresh({ timezoneId: 'Pacific/Honolulu', now });
  await page.goto(`${PAGE}&trade=plumbing`);
  await page.waitForSelector('.b-choice');
  await page.click('.b-choice:nth-child(2)');
  await describeAndSpeed(page, 'STANDARD', 'Kitchen sink drains slowly and gurgles.');
  await page.waitForSelector('[data-window]');
  // No home yet: the browser's clock stands in, so "Tomorrow" is Oct 16 here.
  assert.equal(await page.$eval('[data-day]:nth-child(1)', (b) => b.dataset.day), '2026-10-16');
  await page.click('[data-day]:nth-child(1)');
  await page.click('[data-window=MIDDAY]');
  await page.click('[data-key=next]');
  await signUp(page);
  await addHome(page);
  // The home is in Chicago, where Oct 16 is already today: back to the days, with why.
  await page.waitForSelector('[data-window]');
  await page.waitForFunction(() => /Standard starts tomorrow\. Pick another day\. Days and arrival windows are the home’s time \(CDT\)\./.test(document.getElementById('book-toast').textContent));
  await snap(page, 'schedule-home-clock');
  assert.equal(await page.$eval('[data-day]:nth-child(1)', (b) => `${b.dataset.day} ${b.textContent}`), '2026-10-17 Tomorrow');
  assert.equal(await page.$('[data-day="2026-10-16"]'), null, 'today at the home isn’t offered');
  assert.equal(await page.textContent('.b-clock'), 'Days and arrival windows are the home’s time (CDT).');
  await page.click('[data-day]:nth-child(1)');
  await page.click('[data-window=MIDDAY]');
  await page.click('[data-key=next]');
  await page.waitForSelector('[data-key=confirm]');
  assert.match(await page.textContent('.b-card'), /Tomorrow, midday 11 AM–2 PM CDT/);
  await page.waitForFunction(() => document.body.textContent.includes('Free to cancel up to 24 hours'));
  await page.click('[data-key=confirm]');
  await page.waitForSelector('[data-contractor=c-1]');
  const calls = await log();
  const job = calls.find((c) => c.path === '/jobs' && c.method === 'POST').body;
  // Midnight at the home (CDT): with the window the server makes it 11 AM in Chicago.
  assert.equal(job.scheduledDate, '2026-10-17T00:00:00-05:00');
  assert.equal(job.scheduledTimeWindow, 'MIDDAY');
  const terms = calls.filter((c) => c.path.startsWith('/jobs/cancellation-terms')).pop();
  assert.equal(new URL(terms.path, BASE).searchParams.get('scheduledDate'), job.scheduledDate, 'the terms are asked for the same moment');
  console.log('✓ Home’s clock: a Honolulu browser booking a Chicago home: the day is re-checked at the home, "Tomorrow" is the home’s, and 2026-10-17T00:00:00-05:00 is sent');
  await ctx.close();
}
