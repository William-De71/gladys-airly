// The traps of the Gladys core that the fake Gladys does not catch
// (community feedback, thread 11005): should_poll with poll_frequency, min /
// max / read_only / has_feedback on every feature, category / type pairs, and
// a single invalid field rejecting the whole discovery batch.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import {
  DEVICE_FEATURE_CATEGORIES as C,
  DEVICE_FEATURE_TYPES as T,
  DEVICE_FEATURE_UNITS as U,
} from '@gladysassistant/integration-sdk';

import {
  placeKey,
  idsOf,
  keyOfExternalId,
  optionalKeysOf,
  buildPlaceDevice,
  buildPlaceStates,
  forecastLine,
  OPTIONAL_KEYS,
} from '../src/device.js';
import { parseMeasurements, forecastPeak } from '../src/parse.js';
import { LANGUAGES } from '../src/i18n.js';
import { fixture, rebase, NOW, TZ } from './helpers/fake-api.js';

const fakeGladys = {
  externalIds: (type, id) => ({
    device: `ext:airly:${type}:${id}`,
    feature: (key) => `ext:airly:${type}:${id}:${key}`,
  }),
};
const point = parseMeasurements(rebase(fixture('measurements_point.json')));
const sensor = parseMeasurements(rebase(fixture('measurements_installation.json')));
const HOME = {
  key: placeKey({ house: 'Main_House 2' }),
  installationId: null,
  house: 'Main_House 2',
  mode: 'point',
  name: 'Main house',
  features: optionalKeysOf(point),
};
const SENSOR = {
  key: placeKey({ installationId: 204 }),
  installationId: 204,
  house: null,
  name: 'Kraków, Mikołajska',
  features: [],
};
const devices = (language, gladys = fakeGladys) => [
  buildPlaceDevice(gladys, HOME, language),
  buildPlaceDevice(gladys, SENSOR, language),
];

const PAIRS = [
  [C.AIRQUALITY_SENSOR, T.AIRQUALITY_SENSOR.AQI, U.AQI],
  [C.PM25_SENSOR, T.SENSOR.DECIMAL, U.MICROGRAM_PER_CUBIC_METER],
  [C.PM10_SENSOR, T.SENSOR.DECIMAL, U.MICROGRAM_PER_CUBIC_METER],
  [C.NO2_SENSOR, T.SENSOR.DECIMAL, U.MICROGRAM_PER_CUBIC_METER],
  [C.O3_SENSOR, T.SENSOR.DECIMAL, U.MICROGRAM_PER_CUBIC_METER],
  [C.SO2_SENSOR, T.SENSOR.DECIMAL, U.MICROGRAM_PER_CUBIC_METER],
  [C.TEMPERATURE_SENSOR, T.SENSOR.DECIMAL, U.CELSIUS],
  [C.HUMIDITY_SENSOR, T.SENSOR.DECIMAL, U.PERCENT],
  [C.PRESSURE_SENSOR, T.SENSOR.DECIMAL, U.HECTO_PASCAL],
  [C.TEXT, T.TEXT.TEXT, undefined],
];

test('devices are never polled by Gladys: the integration has its own timer', () => {
  for (const device of devices('en')) {
    assert.equal(device.should_poll, false);
    assert.equal(device.poll_frequency, undefined);
  }
});

test('every feature carries min, max, read_only and has_feedback, in every language', () => {
  for (const language of LANGUAGES) {
    for (const device of devices(language)) {
      for (const feature of device.features) {
        assert.equal(typeof feature.min, 'number', feature.external_id);
        assert.equal(typeof feature.max, 'number', feature.external_id);
        assert.ok(feature.min <= feature.max);
        assert.equal(feature.read_only, true);
        assert.equal(feature.has_feedback, false);
      }
      assert.equal(
        new Set(device.features.map((f) => f.name)).size,
        device.features.length,
        'distinct names',
      );
    }
  }
});

test('category / type / unit pairs known to the Gladys front', () => {
  for (const feature of devices('en').flatMap((device) => device.features)) {
    assert.ok(
      PAIRS.some(
        ([c, ty, u]) => feature.category === c && feature.type === ty && feature.unit === u,
      ),
      `${feature.external_id}: ${feature.category}/${feature.type}/${feature.unit}`,
    );
  }
});

test('ids from the place as configured, names from the place; optional features only grow', () => {
  const [home, kraków] = devices('fr');
  assert.equal(home.external_id, 'ext:airly:place:house-main_house-2');
  assert.equal(home.name, 'Airly Main house');
  assert.equal(kraków.external_id, 'ext:airly:place:installation-204');
  assert.deepEqual(
    kraków.features.map((f) => f.external_id.split(':').pop()),
    ['caqi', 'level', 'pm25', 'pm10', 'forecast_caqi', 'forecast'],
  );
  assert.deepEqual(home.features.length, 6 + OPTIONAL_KEYS.length);
  assert.deepEqual(optionalKeysOf(sensor), ['no2']);
  assert.deepEqual(home.params, [
    { name: 'AIRLY_HOUSE', value: 'Main_House 2' },
    { name: 'AIRLY_MODE', value: 'point' },
  ]);
  assert.deepEqual(kraków.params, [{ name: 'AIRLY_INSTALLATION_ID', value: '204' }]);
  assert.equal(
    keyOfExternalId('ext:airly:place:installation-204:forecast_caqi'),
    'installation-204',
  );
  assert.equal(keyOfExternalId('ext:airly:place:house-main_house-2'), 'house-main_house-2');
  assert.equal(keyOfExternalId('nothing'), null);
});

test('states: values, level and forecast as texts; what Airly did not give is left untouched', () => {
  const peak = forecastPeak(point, NOW);
  const byKey = (states) =>
    Object.fromEntries(
      states.map((s) => [s.device_feature_external_id.split(':').pop(), s.state ?? s.text]),
    );
  assert.deepEqual(
    byKey(buildPlaceStates(fakeGladys, HOME, point, peak, { language: 'de', timeZone: TZ })),
    {
      caqi: 7,
      level: 'Sehr gut',
      pm25: 4.4,
      pm10: 6.1,
      temperature: 14.4,
      humidity: 68.4,
      pressure: 1019.9,
      no2: 16,
      o3: 41.5,
      so2: 14,
      forecast_caqi: 23,
      forecast: 'Höchstwert in 24 Std.: 23, Sehr gut, um 15:00',
    },
  );
  assert.deepEqual(
    byKey(buildPlaceStates(fakeGladys, SENSOR, sensor, null, { language: 'en', timeZone: TZ })),
    { caqi: 44, level: 'Good', pm25: 26.6, pm10: 29.4 },
    'no forecast, NO₂ not created yet',
  );
  assert.deepEqual(buildPlaceStates(fakeGladys, SENSOR, null, null, { language: 'en' }), []);
  assert.equal(forecastLine(null, 'en'), '');
  const smog = { ...sensor, caqi: 900 };
  assert.equal(buildPlaceStates(fakeGladys, SENSOR, smog, null, { language: 'en' })[0].state, 500);
});

test('the discovery batch and the states pass the checks of the fake host API', async (t) => {
  const gladys = createFakeGladys({});
  t.after(() => gladys.fake.shutdown());
  await gladys.connect();
  for (const language of LANGUAGES) {
    await gladys.publishDiscoveredDevices(devices(language, gladys));
  }
  await gladys.fake.deviceCreated(gladys.fake.discoveredDevices[0]);
  await gladys.publishStates(
    buildPlaceStates(gladys, HOME, point, forecastPeak(point, NOW), {
      language: 'en',
      timeZone: TZ,
    }),
  );
  assert.equal(gladys.fake.lastState(idsOf(gladys, HOME.key).feature('caqi')), 7);
  assert.equal(gladys.fake.lastState(idsOf(gladys, HOME.key).feature('level')), 'Very good');
});
