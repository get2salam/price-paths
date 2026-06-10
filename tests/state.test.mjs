import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SPEC,
  bestActiveItem,
  bumpDate,
  clamp,
  daysFromToday,
  isValidISODate,
  normalize,
  priority,
  safeLoad,
  todayISO,
} from '../js/state.js';

test('isValidISODate rejects calendar rollover like 2026-04-31', () => {
  // The Date constructor silently rolls these over (Apr 31 -> May 1,
  // Feb 29 on a non-leap year -> Mar 1), which corrupts review dates
  // when an imported backup contains a typo.
  assert.equal(isValidISODate('2026-04-31'), false);
  assert.equal(isValidISODate('2026-02-29'), false);
  assert.equal(isValidISODate('2026-13-01'), false);
  assert.equal(isValidISODate('2026-00-10'), false);
});

test('isValidISODate accepts real calendar dates including leap day', () => {
  assert.equal(isValidISODate('2024-02-29'), true);
  assert.equal(isValidISODate('2026-04-30'), true);
  assert.equal(isValidISODate('2026-01-01'), true);
  assert.equal(isValidISODate('2026-12-31'), true);
});

test('isValidISODate rejects non-string and malformed input', () => {
  assert.equal(isValidISODate(null), false);
  assert.equal(isValidISODate(undefined), false);
  assert.equal(isValidISODate(20260101), false);
  assert.equal(isValidISODate('2026/04/30'), false);
  assert.equal(isValidISODate('2026-4-30'), false);
  assert.equal(isValidISODate('not-a-date'), false);
});

test('normalize replaces an invalid review date with a near-future placeholder', () => {
  const item = normalize({ title: 'A', date: '2026-04-31' });
  assert.equal(isValidISODate(item.date), true);
});

test('bumpDate resets to today when the base date is a calendar rollover', () => {
  // Once the validator catches rollover, bumpDate should fall back to today
  // instead of advancing from a silently rewritten anchor.
  const today = todayISO();
  assert.equal(bumpDate('2026-04-31', 0), today);
  assert.equal(bumpDate('not-a-date', 0), today);
});

test('bestActiveItem ignores validated and dropped paths', () => {
  const today = '2026-06-10';
  const items = [
    normalize({ title: 'Already validated', state: 'Validated', score: 10, effort: 1, metric: 10, date: '2026-06-14' }),
    normalize({ title: 'Active testing',     state: 'Testing',   score: 7,  effort: 4, metric: 6,  date: '2026-06-12' }),
    normalize({ title: 'Already dropped',    state: 'Dropped',   score: 9,  effort: 2, metric: 9,  date: '2026-06-13' }),
  ];
  const best = bestActiveItem(items, today);
  assert.ok(best, 'expected an active best bet');
  assert.equal(best.title, 'Active testing');
});

test('bestActiveItem returns null when every path is completed', () => {
  const items = [
    normalize({ title: 'V', state: 'Validated' }),
    normalize({ title: 'D', state: 'Dropped' }),
  ];
  assert.equal(bestActiveItem(items, '2026-06-10'), null);
});

test('bestActiveItem ranks active items by priority, then earlier date', () => {
  const today = '2026-06-10';
  const items = [
    normalize({ title: 'Lower priority', state: 'Testing',   score: 5, effort: 5, metric: 5, date: '2026-06-12' }),
    normalize({ title: 'Top priority',   state: 'Testing',   score: 9, effort: 2, metric: 9, date: '2026-06-14' }),
    normalize({ title: 'Mid priority',   state: 'Exploring', score: 7, effort: 3, metric: 6, date: '2026-06-11' }),
  ];
  assert.equal(bestActiveItem(items, today).title, 'Top priority');
});

test('priority gives no due-boost to completed paths', () => {
  const today = '2026-06-10';
  const completed = normalize({ title: 'A', state: 'Validated', score: 8, effort: 3, metric: 8, date: '2026-06-09' });
  const active    = normalize({ title: 'B', state: 'Testing',   score: 8, effort: 3, metric: 8, date: '2026-06-11' });
  assert.ok(priority(active, today) > priority(completed, today),
    `expected active path to outrank a completed one with identical inputs`);
});

test('priority stays finite for items with malformed dates', () => {
  const today = '2026-06-10';
  const item = { ...normalize({ title: 'X', state: 'Testing', score: 7, metric: 7, effort: 3 }), date: 'broken' };
  assert.doesNotThrow(() => priority(item, today));
  assert.equal(Number.isFinite(priority(item, today)), true);
});

test('daysFromToday is deterministic when given an anchor', () => {
  assert.equal(daysFromToday('2026-06-12', '2026-06-10'), 2);
  assert.equal(daysFromToday('2026-06-09', '2026-06-10'), -1);
  assert.equal(daysFromToday('not-a-date', '2026-06-10'), 999);
});

test('clamp coerces non-numeric input to the lower bound', () => {
  assert.equal(clamp('xyz', 1, 10), 1);
  assert.equal(clamp(15, 1, 10), 10);
  assert.equal(clamp(-3, 1, 10), 1);
  assert.equal(clamp(5, 1, 10), 5);
});

test('normalize clamps score, effort, and confidence into the spec range', () => {
  const item = normalize({ title: 'A', score: 99, effort: -3, metric: 50 });
  assert.equal(item.score, 10);
  assert.equal(item.effort, 1);
  assert.equal(item.metric, SPEC.metric.max);
});

test('safeLoad falls back to the seeded board for malformed input', () => {
  assert.equal(safeLoad(null).items.length, SPEC.items.length);
  assert.equal(safeLoad('not-an-object').items.length, SPEC.items.length);
  assert.equal(safeLoad({ items: 'oops' }).items.length, 0);
});
