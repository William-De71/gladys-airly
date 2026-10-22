import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  observedAt,
  zoneOffset,
  localDate,
  daysBetween,
  formatTime,
  formatDay,
} from '../src/time.js';
import { categoryOfAqi, categoryOf, rankOf, worse, pollutantOf } from '../src/aqi.js';

test('observation hours: the end of the hour, in the zone of the area', () => {
  assert.equal(
    new Date(observedAt('2026-09-09', '18:00', 'PDT')).toISOString(),
    '2026-09-10T01:00:00.000Z',
  );
  assert.equal(
    new Date(observedAt('2026-01-09', 8, 'AKT')).toISOString(),
    '2026-01-09T17:00:00.000Z',
  );
  assert.equal(observedAt('2026-09-09', '18:00', 'XYZ'), null);
  // "00:00" dated the next day, read before it: the end of the day before.
  const now = Date.parse('2026-09-10T06:30:00Z');
  assert.equal(
    new Date(observedAt('2026-09-10', '00:00', 'PDT', now)).toISOString(),
    '2026-09-10T07:00:00.000Z',
  );
  assert.equal(
    new Date(observedAt('2026-09-11', '00:00', 'PDT', now)).toISOString(),
    '2026-09-10T07:00:00.000Z',
  );
  assert.equal(zoneOffset('ndt'), -2.5);
});

test('dates and formats', () => {
  assert.equal(localDate(Date.parse('2026-09-10T01:00:00Z'), -7), '2026-09-09');
  assert.equal(localDate(Date.parse('2026-09-10T01:00:00Z'), 'Europe/Paris'), '2026-09-10');
  assert.equal(daysBetween('2026-09-09', '2026-09-11'), 2);
  assert.equal(
    formatTime(Date.parse('2026-09-10T01:00:00Z'), {
      language: 'en',
      timeZone: 'America/Los_Angeles',
    }),
    '6:00 PM',
  );
  assert.equal(
    formatTime(Date.parse('2026-09-10T01:00:00Z'), { language: 'fr', timeZone: 'Europe/Paris' }),
    '03:00',
  );
  assert.equal(formatDay('2026-09-11', 'en'), 'Fri 11');
  assert.equal(formatDay('2026-09-11', 'es'), 'vie 11');
});

test('the AQI scale of the EPA', () => {
  assert.deepEqual([0, 50, 51, 100, 101, 150, 151, 200, 201, 300, 301, 874].map(categoryOfAqi), [
    'good',
    'good',
    'moderate',
    'moderate',
    'sensitive',
    'sensitive',
    'unhealthy',
    'unhealthy',
    'very_unhealthy',
    'very_unhealthy',
    'hazardous',
    'hazardous',
  ]);
  assert.equal(categoryOfAqi(-1), null);
  assert.equal(categoryOf('Unhealthy for Sensitive Groups'), 'sensitive');
  assert.equal(categoryOf(5), 'very_unhealthy');
  assert.equal(categoryOf(7), null, 'unavailable');
  assert.equal(rankOf('hazardous'), 6);
  assert.equal(worse('good', 'unhealthy'), 'unhealthy');
  assert.equal(worse('unhealthy', null), 'unhealthy');
  assert.deepEqual(['PM2.5', 'OZONE', 'Ozone', 'PM25', 'NO2', 'X'].map(pollutantOf), [
    'pm25',
    'ozone',
    'ozone',
    'pm25',
    'no2',
    null,
  ]);
});
