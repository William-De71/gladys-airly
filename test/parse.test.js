import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseMeasurements, forecastPeak, parseInstallation } from '../src/parse.js';
import { levelOf, rankOf, LEVEL_KEYS } from '../src/caqi.js';
import { AirlyError } from '../src/airly-api.js';
import { fixture, rebase, NOW } from './helpers/fake-api.js';

const HOUR = 60 * 60 * 1000;

test('the CAQI levels come from the value, a bound belongs to the level above', () => {
  assert.equal(levelOf(0), 'very_low');
  assert.equal(levelOf(24.9), 'very_low');
  assert.equal(levelOf(25), 'low');
  assert.equal(levelOf(62), 'medium');
  assert.equal(levelOf(75), 'high');
  assert.equal(levelOf(100), 'very_high');
  assert.equal(levelOf(180), 'very_high');
  assert.equal(levelOf(null), null);
  assert.equal(levelOf(-1), null);
  assert.deepEqual(LEVEL_KEYS.map(rankOf), [0, 1, 2, 3, 4]);
});

test('a point: the CAQI, every value, the WHO guideline values, 24 + 24 hours', () => {
  const reading = parseMeasurements(rebase(fixture('measurements_point.json')));
  assert.equal(reading.caqi, 7);
  assert.equal(reading.level, 'very_low');
  assert.deepEqual(reading.values, {
    pm1: 2.8,
    pm25: 4.4,
    pm10: 6.1,
    pressure: 1019.9,
    humidity: 68.4,
    temperature: 14.4,
    no2: 16,
    o3: 41.5,
    so2: 14,
    co: 162.5,
  });
  assert.deepEqual(reading.who, {
    pm25: { limit: 15, percent: 29 },
    pm10: { limit: 45, percent: 15 },
    no2: { limit: 25, percent: 64 },
    o3: { limit: 100, percent: 42 },
  });
  assert.equal(reading.history.length, 24);
  assert.equal(reading.forecast.length, 24);
  assert.ok(reading.at > reading.from);
  assert.ok(reading.history.every((point, i, all) => i === 0 || point.at > all[i - 1].at));
});

test('a sensor without forecast: the hours without a CAQI are left out', () => {
  const reading = parseMeasurements(rebase(fixture('measurements_installation.json')));
  assert.equal(reading.caqi, 44);
  assert.equal(reading.level, 'low');
  assert.deepEqual(reading.values, { pm25: 26.6, pm10: 29.4, no2: 46.2 });
  assert.equal(reading.who.pm25.percent, 106);
  assert.equal(reading.forecast.length, 0);
  assert.equal(forecastPeak(reading, NOW), null);
});

test('no sensor near the point: no_data, never a CAQI of 0', () => {
  assert.throws(
    () => parseMeasurements(rebase(fixture('measurements_no_station.json'))),
    (err) =>
      err instanceof AirlyError && err.kind === 'no_data' && /no Airly sensors/.test(err.message),
  );
});

test('the forecast peak: the highest CAQI to come within the window, the first on a tie', () => {
  const reading = parseMeasurements(rebase(fixture('measurements_point.json')));
  const peak = forecastPeak(reading, NOW);
  assert.equal(peak.caqi, 23);
  assert.equal(peak.level, 'very_low');
  assert.ok(peak.at > NOW);
  const soon = forecastPeak(reading, NOW, 3 * HOUR);
  assert.ok(soon.caqi < peak.caqi);
  const tie = {
    forecast: [
      { at: NOW + HOUR, caqi: 50 },
      { at: NOW + 2 * HOUR, caqi: 50 },
    ],
  };
  assert.equal(forecastPeak(tie, NOW).at, NOW + HOUR);
  assert.equal(forecastPeak({ forecast: [{ at: NOW - HOUR, caqi: 90 }] }, NOW), null);
});

test('the name of a sensor, from its address', () => {
  assert.deepEqual(parseInstallation(fixture('installations_nearest.json')), {
    id: 204,
    name: 'Kraków, Mikołajska',
    city: 'Kraków',
    latitude: 50.062006,
    longitude: 19.940984,
    airly: true,
  });
  assert.equal(
    parseInstallation({ id: 3, address: { city: 'Gdańsk', street: 'Długa', number: '1' } }).name,
    'Gdańsk, Długa 1',
  );
  assert.equal(parseInstallation({}).name, '');
});
