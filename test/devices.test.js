// The traps of the Gladys core that the fake Gladys does not catch
// (community feedback, thread 11005): should_poll with poll_frequency, min /
// max / read_only / has_feedback on every feature, category / type pairs, and
// a single invalid field rejecting the whole discovery batch.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';

import {
  placeKey,
  idsOf,
  keyOfExternalId,
  buildPlaceDevice,
  buildPlaceStates,
  forecastLine,
} from '../src/device.js';
import { parseObservations, parseForecast } from '../src/parse.js';
import { LANGUAGES } from '../src/i18n.js';
import { fixture } from './helpers/fake-api.js';

const fakeGladys = {
  externalIds: (type, id) => ({
    device: `ext:airnow:${type}:${id}`,
    feature: (key) => `ext:airnow:${type}:${id}:${key}`,
  }),
};
const LA = {
  key: 'zip-90210',
  zip: '90210',
  house: null,
  area: 'NW Coastal LA',
  label: 'ZIP 90210',
};
const HOME = {
  key: placeKey({ house: 'Main_House 2' }),
  zip: null,
  house: 'Main_House 2',
  area: '',
  label: 'Main house',
};
const observations = parseObservations(fixture('observation_current_ziplatLong.json'));
const [today, tomorrow] = parseForecast(fixture('forecast_current__zip.json')).days;
const devices = (language, gladys = fakeGladys) => [
  buildPlaceDevice(gladys, LA, language),
  buildPlaceDevice(gladys, HOME, language),
];

const PAIRS = [
  [
    DEVICE_FEATURE_CATEGORIES.AIRQUALITY_SENSOR,
    DEVICE_FEATURE_TYPES.AIRQUALITY_SENSOR.AQI,
    DEVICE_FEATURE_UNITS.AQI,
  ],
  [DEVICE_FEATURE_CATEGORIES.TEXT, DEVICE_FEATURE_TYPES.TEXT.TEXT, undefined],
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

test('ids from the place as configured; names from the reporting area', () => {
  const [la, home] = devices('fr');
  assert.equal(la.external_id, 'ext:airnow:place:zip-90210');
  assert.equal(la.name, 'AirNow NW Coastal LA');
  assert.equal(home.external_id, 'ext:airnow:place:house-main_house-2');
  assert.equal(home.name, 'AirNow Main house', 'before the first reading');
  assert.equal(keyOfExternalId('ext:airnow:place:zip-90210:forecast_today'), 'zip-90210');
  assert.equal(keyOfExternalId('ext:airnow:place:house-main_house-2'), 'house-main_house-2');
  assert.equal(keyOfExternalId('nothing'), null);
  assert.deepEqual(la.params, [
    { name: 'AIRNOW_ZIP', value: '90210' },
    { name: 'AIRNOW_REPORTING_AREA', value: 'NW Coastal LA' },
  ]);
});

test('states: AQI values, the category and the forecast as texts; missing values untouched', () => {
  const byKey = (states) =>
    Object.fromEntries(
      states.map((s) => [s.device_feature_external_id.split(':').pop(), s.state ?? s.text]),
    );
  assert.deepEqual(
    byKey(buildPlaceStates(fakeGladys, LA.key, { observations, today, tomorrow }, 'de')),
    {
      aqi: 34,
      pm25: 11,
      ozone: 34,
      pm10: 15,
      category: 'Gut',
      forecast_today: 53,
      forecast_tomorrow: 53,
      forecast: 'Morgen: Mäßig (PM2,5)',
    },
  );
  assert.deepEqual(
    buildPlaceStates(fakeGladys, LA.key, { observations: null, today: null, tomorrow: null }, 'en'),
    [],
  );
  assert.equal(
    forecastLine({ ...tomorrow, actionDay: true }, 'Tomorrow', 'en'),
    'Tomorrow: Moderate (PM2.5), air quality alert',
  );
  const smoke = { ...observations, aqi: 1200, pollutants: {} };
  assert.equal(buildPlaceStates(fakeGladys, LA.key, { observations: smoke }, 'en')[0].state, 999);
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
    buildPlaceStates(gladys, LA.key, { observations, today, tomorrow }, 'en'),
  );
  assert.equal(gladys.fake.lastState(idsOf(gladys, LA.key).feature('aqi')), 34);
  assert.equal(gladys.fake.lastState(idsOf(gladys, LA.key).feature('category')), 'Good');
});
