import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  detectLevelChange,
  detectForecastAlert,
  detectWhoExceeded,
  changedData,
  expectedData,
  whoData,
  pick,
  AIR_QUALITY_OUTPUTS,
} from '../src/events.js';
import { parseMeasurements } from '../src/parse.js';
import { fixture, rebase, NOW, TZ } from './helpers/fake-api.js';

const HOUR = 60 * 60 * 1000;
const place = { deviceId: 'ext:airly:place:installation-204', name: 'Kraków, Mikołajska' };
const reading = parseMeasurements(rebase(fixture('measurements_installation.json')));

/**
 * @description Every value of a payload is a flat scalar, strings 1,000 characters at most.
 * @param {object} data - The payload.
 */
function assertFlat(data) {
  assert.ok(Object.keys(data).length <= 30);
  for (const [key, value] of Object.entries(data)) {
    assert.ok(
      value === null ||
        typeof value === 'boolean' ||
        Number.isFinite(value) ||
        (typeof value === 'string' && value.length <= 1000),
      key,
    );
  }
}

test('the level now: a change with its direction; the first reading is a baseline', () => {
  assert.equal(detectLevelChange(undefined, 'low'), null);
  assert.equal(detectLevelChange('low', 'low'), null);
  assert.equal(detectLevelChange('low', null), null);
  assert.deepEqual(detectLevelChange('low', 'high'), { direction: 'worse', previous: 'low' });
  assert.deepEqual(detectLevelChange('very_high', 'medium'), {
    direction: 'better',
    previous: 'very_high',
  });
});

test('the forecast alert: once per episode, again when worse, armed again below high', () => {
  const peak = (level) => ({ caqi: 90, level, at: NOW + 5 * HOUR });
  assert.deepEqual(detectForecastAlert(undefined, peak('high')), { fire: false, next: 'high' });
  assert.deepEqual(detectForecastAlert(null, peak('medium')), { fire: false, next: null });
  assert.deepEqual(detectForecastAlert(null, peak('high')), { fire: true, next: 'high' });
  assert.deepEqual(detectForecastAlert('high', peak('high')), { fire: false, next: 'high' });
  assert.deepEqual(detectForecastAlert('high', peak('very_high')), {
    fire: true,
    next: 'very_high',
  });
  assert.deepEqual(detectForecastAlert('very_high', peak('high')), { fire: false, next: 'high' });
  assert.deepEqual(detectForecastAlert('high', null), { fire: false, next: null });
});

test('the WHO guideline values: the pollutants that go over, once', () => {
  const who = { pm25: { limit: 15, percent: 120 }, pm10: { limit: 45, percent: 90 } };
  assert.deepEqual(detectWhoExceeded(undefined, who), { newly: [], next: ['pm25'] });
  assert.deepEqual(detectWhoExceeded([], who), { newly: ['pm25'], next: ['pm25'] });
  assert.deepEqual(detectWhoExceeded(['pm25'], who), { newly: [], next: ['pm25'] });
  assert.deepEqual(detectWhoExceeded(['pm25'], {}), { newly: [], next: [] });
});

test('payloads: flat scalars, the declared variables', () => {
  const changed = changedData(place, reading, { direction: 'worse', previous: 'very_low' }, 'fr');
  assert.deepEqual(changed, {
    place: place.deviceId,
    name: 'Kraków, Mikołajska',
    caqi: 44,
    level: 'low',
    level_name: 'Bonne',
    previous_level: 'very_low',
    direction: 'worse',
    pm25: 26.6,
    pm10: 29.4,
  });
  const expected = expectedData(
    place,
    reading,
    { caqi: 92, level: 'very_high', at: NOW + 4 * HOUR },
    { language: 'de', timeZone: TZ, now: NOW },
  );
  assert.deepEqual(expected, {
    place: place.deviceId,
    name: 'Kraków, Mikołajska',
    caqi: 92,
    level: 'very_high',
    level_name: 'Sehr schlecht',
    time: '22:20',
    hours: 4,
    current_caqi: 44,
  });
  const who = whoData(place, reading, 'pm25', 'es');
  assert.deepEqual(who, {
    place: place.deviceId,
    name: 'Kraków, Mikołajska',
    pollutant: 'pm25',
    pollutant_name: 'PM2,5',
    value: 26.6,
    limit: 25,
    percent: 106,
  });
  [changed, expected, who].forEach(assertFlat);
});

test('scene action outputs: only the declared keys, null when unknown', () => {
  const outputs = pick({ caqi: 44, extra: 'x' }, AIR_QUALITY_OUTPUTS);
  assert.deepEqual(Object.keys(outputs), AIR_QUALITY_OUTPUTS);
  assert.equal(outputs.caqi, 44);
  assert.equal(outputs.pm1, null);
});
