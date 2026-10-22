import { test } from 'node:test';
import assert from 'node:assert/strict';

import { utcDay, msToUtcMidnight, formatTime, hoursBetween, HOUR_MS } from '../src/time.js';

test('UTC days and the time left until midnight UTC (the reset of the daily limit)', () => {
  const instant = Date.parse('2026-10-22T23:30:00Z');
  assert.equal(utcDay(instant), '2026-10-22');
  assert.equal(msToUtcMidnight(instant), HOUR_MS / 2);
  assert.equal(msToUtcMidnight(Date.parse('2026-10-22T00:00:00Z')), 24 * HOUR_MS);
});

test('times in the language and the timezone of the user', () => {
  const instant = Date.parse('2026-10-22T16:00:00Z');
  assert.equal(formatTime(instant, { language: 'fr', timeZone: 'Europe/Warsaw' }), '18:00');
  assert.equal(formatTime(instant, { language: 'en', timeZone: 'Europe/Warsaw' }), '6:00 PM');
  assert.equal(formatTime(null), '');
  assert.equal(hoursBetween(instant, instant + 90 * 60 * 1000), 2);
  assert.equal(hoursBetween(instant, instant - HOUR_MS), 0);
});
