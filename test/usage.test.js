import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  usageOf,
  limitOf,
  remainingOf,
  planInterval,
  mayRequest,
  freshUsage,
  RESERVE,
} from '../src/usage.js';

const MINUTE = 60 * 1000;
const MIDNIGHT = Date.parse('2026-10-22T00:00:00Z');

test('the usage is per UTC day: reset at midnight UTC, the limit known is kept', () => {
  const usage = { day: '2026-10-22', count: 42, limit: 1000, remaining: 958 };
  assert.equal(usageOf(usage, MIDNIGHT + 23 * 60 * MINUTE), usage);
  assert.deepEqual(usageOf(usage, MIDNIGHT + 24 * 60 * MINUTE), {
    day: '2026-10-23',
    count: 0,
    limit: 1000,
    remaining: null,
  });
  assert.deepEqual(usageOf(undefined, MIDNIGHT), freshUsage('2026-10-22'));
});

test('limit and remaining: the free limit by default, never more than our own count allows', () => {
  assert.equal(limitOf(freshUsage('d')), 100);
  assert.equal(remainingOf({ count: 10, limit: null, remaining: null }), 90);
  assert.equal(remainingOf({ count: 10, limit: 100, remaining: 95 }), 90);
  assert.equal(remainingOf({ count: 10, limit: 100, remaining: 50 }), 50);
  assert.equal(mayRequest({ count: 100 - RESERVE, limit: 100 }, false), false);
  assert.equal(mayRequest({ count: 100 - RESERVE, limit: 100 }, true), true);
  assert.equal(mayRequest({ count: 100, limit: 100 }, true), false);
});

test('the plan: every 30 minutes at least, stretched by the places and by what remains', () => {
  const start = MIDNIGHT + MINUTE;
  const today = (count = 0, limit = null) => ({ day: '2026-10-22', count, limit, remaining: null });
  assert.equal(planInterval({ usage: today(), places: 1, now: start }), 30 * MINUTE);
  // 90 requests for 3 places: 30 rounds, one every 48 minutes -> 50.
  assert.equal(planInterval({ usage: today(), places: 3, now: start }), 50 * MINUTE);
  assert.equal(planInterval({ usage: today(0, 1000), places: 3, now: start }), 30 * MINUTE);
  // At noon with 70 spent: 20 left for 3 places, 6 rounds in 12 hours -> 2 hours.
  const noon = MIDNIGHT + 12 * 60 * MINUTE;
  assert.equal(planInterval({ usage: today(70), places: 3, now: noon }), 120 * MINUTE);
  assert.equal(planInterval({ usage: today(90), places: 1, now: noon }), null, 'the reserve');
  assert.equal(planInterval({ usage: today(), places: 0, now: noon }), null);
});
