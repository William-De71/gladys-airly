// The whole integration against the fake Gladys of the SDK
// (`@gladysassistant/integration-sdk/testing`), which checks the discovered
// devices, the states and the scene events like the host API does, and a fake
// AirNow API serving real answers of the 2026 services.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import { createApp, SCENE_ACTIONS, ACTIONS } from '../src/app.js';
import { WIDGETS, WIDGET_ACTIONS } from '../src/widgets.js';
import { TRIGGERS } from '../src/events.js';
import {
  fakeAirNow,
  storePath,
  silent,
  NOW,
  TZ,
  KEY,
  NAPA,
  NEVADA,
  fixture,
} from './helpers/fake-api.js';

const CONFIG = { api_key: KEY, zip_1: '90210', house_2: 'napa-house', language: 'en' };
const HOUSES = [
  { selector: 'napa-house', name: 'Napa house', ...NAPA },
  { selector: 'desert', name: 'Desert', ...NEVADA },
  { selector: 'nowhere', name: 'No location' },
];
const PREFIX = 'ext:test-integration';
const LA = `${PREFIX}:place:zip-90210`;
const NAPA_ID = `${PREFIX}:place:house-napa-house`;
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/**
 * @description The integration, connected to a fake Gladys and a fake API.
 * @param {object} [options] - `{ config, api, path, now }`.
 * @returns {Promise<object>} `{ gladys, app, api, clock, path }`.
 */
async function startApp({
  config = CONFIG,
  api = fakeAirNow(),
  path = storePath(),
  now = NOW,
} = {}) {
  const clock = { now };
  const gladys = createFakeGladys({ config, houses: HOUSES });
  const app = createApp(gladys, {
    fetch: api,
    storePath: path,
    now: () => clock.now,
    timeZone: TZ,
    timers: false,
    logger: silent,
  });
  await gladys.connect();
  await app.whenReady();
  return { gladys, app, api, clock, path };
}

const created = async (gladys, externalId) => {
  const device = gladys.fake.discoveredDevices.find((d) => d.external_id === externalId);
  assert.ok(device, `${externalId} is offered`);
  await gladys.fake.deviceCreated(device);
  return device;
};
const eventsOf = (gladys, key) => gladys.fake.sceneEvents.filter((event) => event.key === key);

test('a ZIP code and a house become two devices named after their reporting area', async (t) => {
  const { gladys, api } = await startApp();
  t.after(() => gladys.fake.shutdown());
  assert.deepEqual(
    gladys.fake.discoveredDevices.map((device) => [device.external_id, device.name]),
    [
      [LA, 'AirNow NW Coastal LA'],
      [NAPA_ID, 'AirNow Napa'],
    ],
  );
  // Two services per place, coordinates rounded, the key in the query.
  assert.deepEqual(
    api.calls.map((call) => [
      call.service,
      call.params.zipCode ?? `${call.params.latitude},${call.params.longitude}`,
    ]),
    [
      ['observations', '90210'],
      ['forecast', '90210'],
      ['observations', '38.3191,-122.2998'],
      ['forecast', '38.3191,-122.2998'],
    ],
  );
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.equal(
    gladys.fake.connectionStatus.message.en,
    'Connected to AirNow: NW Coastal LA AQI 34 (Good), Napa AQI 52 (Moderate).',
  );
  // First readings: a baseline, no event (no action day in the fixtures).
  assert.deepEqual(gladys.fake.sceneEvents, []);
});

test('created devices get the AQI, the pollutants, the category and the forecast', async (t) => {
  const { gladys } = await startApp();
  t.after(() => gladys.fake.shutdown());
  await created(gladys, LA);
  assert.equal(gladys.fake.lastState(`${LA}:aqi`), 34);
  assert.equal(gladys.fake.lastState(`${LA}:pm25`), 11);
  assert.equal(gladys.fake.lastState(`${LA}:ozone`), 34);
  assert.equal(gladys.fake.lastState(`${LA}:pm10`), 15);
  assert.equal(gladys.fake.lastState(`${LA}:category`), 'Good');
  assert.equal(gladys.fake.lastState(`${LA}:forecast_today`), 53);
  assert.equal(gladys.fake.lastState(`${LA}:forecast_tomorrow`), 53);
  assert.equal(gladys.fake.lastState(`${LA}:forecast`), 'Tomorrow: Moderate (PM2.5)');
});

test('readings follow the hour: nothing before hh:35, observations then, forecast every 3 hours', async (t) => {
  const { gladys, app, api, clock } = await startApp();
  t.after(() => gladys.fake.shutdown());
  api.calls.length = 0;
  clock.now += 20 * MINUTE; // 19:00 PDT
  await app.readPlaces();
  assert.equal(api.calls.length, 0, 'the 18:00 observation is still the last one');
  clock.now += 15 * MINUTE; // 19:15... the next mark is 19:35
  await app.readPlaces();
  assert.equal(api.calls.length, 0);
  clock.now += 20 * MINUTE; // 19:35
  await app.readPlaces();
  assert.deepEqual(
    api.calls.map((call) => call.service),
    ['observations', 'observations'],
  );
  clock.now += 3 * HOUR;
  api.calls.length = 0;
  await app.readPlaces();
  assert.deepEqual(api.calls.map((call) => call.service).sort(), [
    'forecast',
    'forecast',
    'observations',
    'observations',
  ]);
});

test('a category change fires air_quality_changed once, with its direction', async (t) => {
  const { gladys, app, api, clock, path } = await startApp();
  t.after(() => gladys.fake.shutdown());
  const rows = fixture('observation_current_ziplatLong.json');
  rows[0].nowcastAQI = 128;
  rows[0].aqiCategoryName = 'Unhealthy for Sensitive Groups';
  api.answers.observations[90210] = rows;
  clock.now += HOUR;
  await app.readPlaces();
  assert.deepEqual(eventsOf(gladys, TRIGGERS.AIR_QUALITY_CHANGED), [
    {
      key: TRIGGERS.AIR_QUALITY_CHANGED,
      data: {
        place: LA,
        area: 'NW Coastal LA',
        aqi: 128,
        category: 'sensitive',
        category_name: 'Unhealthy for sensitive groups',
        previous_category: 'good',
        direction: 'worse',
        pollutant: 'pm25',
        pollutant_name: 'PM2.5',
      },
    },
  ]);
  clock.now += HOUR;
  await app.readPlaces();
  assert.equal(eventsOf(gladys, TRIGGERS.AIR_QUALITY_CHANGED).length, 1, 'same category: nothing');
  // A restart reads nothing fresh and fires nothing again.
  await gladys.fake.shutdown();
  const again = await startApp({ api, path, now: clock.now });
  t.after(() => again.gladys.fake.shutdown());
  assert.deepEqual(again.gladys.fake.sceneEvents, []);
});

test('a new forecast fires forecast_updated, an action day fires action_day', async (t) => {
  const { gladys, app, api, clock } = await startApp();
  t.after(() => gladys.fake.shutdown());
  const rows = fixture('forecast_current__zip.json').map((row) =>
    row.dateValid === '2026-09-10' && row.parameterName === 'OZONE'
      ? {
          ...row,
          aqi: 151,
          categoryNumber: 4,
          categoryName: 'Unhealthy',
          actionDay: true,
          discussion: 'Heat and stagnant air.',
        }
      : row,
  );
  api.answers.forecast[90210] = rows;
  clock.now += 3 * HOUR;
  await app.readPlaces();
  const expected = {
    place: LA,
    area: 'NW Coastal LA',
    date: '2026-09-10',
    day: 'tomorrow',
    aqi: 151,
    category: 'unhealthy',
    category_name: 'Unhealthy',
    pollutant: 'ozone',
    pollutant_name: 'Ozone',
    action_day: true,
    discussion: 'Heat and stagnant air.',
  };
  assert.deepEqual(eventsOf(gladys, TRIGGERS.FORECAST_UPDATED), [
    { key: TRIGGERS.FORECAST_UPDATED, data: expected },
  ]);
  assert.deepEqual(eventsOf(gladys, TRIGGERS.ACTION_DAY), [
    { key: TRIGGERS.ACTION_DAY, data: expected },
  ]);
  clock.now += 3 * HOUR;
  await app.readPlaces();
  assert.equal(eventsOf(gladys, TRIGGERS.ACTION_DAY).length, 1, 'once');
});

test('the scene action reads a place and gives a sentence', async (t) => {
  const { gladys } = await startApp({ config: { ...CONFIG, language: 'fr' } });
  t.after(() => gladys.fake.shutdown());
  const answer = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_AIR_QUALITY, { place: NAPA_ID });
  assert.deepEqual(answer.data.outputs, {
    aqi: 52,
    category: 'moderate',
    category_name: 'Modéré',
    pollutant_name: 'PM2,5',
    area: 'Napa',
    forecast_today_aqi: 61,
    forecast_tomorrow_aqi: 50,
    forecast_tomorrow_category: 'good',
    action_day: false,
    summary: 'Qualité de l’air à Napa : Modéré, AQI 52 (PM2,5). Demain : Bon (PM2,5).',
  });
});

test('widgets: valid contents in every language, for both places', async (t) => {
  const { gladys } = await startApp();
  t.after(() => gladys.fake.shutdown());
  for (const language of ['en', 'fr', 'de', 'es']) {
    for (const key of Object.values(WIDGETS)) {
      for (const place of [undefined, LA, NAPA_ID]) {
        const answer = await gladys.fake.widgetGet(key, {
          language,
          settings: place ? { place } : {},
        });
        assert.ok(answer.success, `${key} ${language}`);
        assert.deepEqual(
          validateWidgetContent(answer.data.content),
          [],
          `${key} ${language} ${place}`,
        );
      }
    }
  }
  const forecast = await gladys.fake.widgetGet(WIDGETS.FORECAST, {
    language: 'en',
    settings: { place: NAPA_ID },
  });
  const list = forecast.data.content.components.find((c) => c.type === 'card-list');
  assert.deepEqual(
    list.items.map((item) => [item.title, item.subtitle, item.badge.text]),
    [
      ['Today', 'Ozone · AQI 61', 'Moderate'],
      ['Tomorrow', 'PM2.5 · AQI 50', 'Good'],
      ['Fri 11', 'Ozone', 'Good'],
      ['Sat 12', 'Ozone', 'Good'],
      ['Sun 13', 'PM2.5', 'Good'],
      ['Mon 14', 'Ozone', 'Good'],
    ],
  );
  const now = await gladys.fake.widgetGet(WIDGETS.AIR_QUALITY, { language: 'en' });
  const tiles = now.data.content.components.filter((c) => c.type === 'value');
  assert.deepEqual(
    tiles.map((tile) => [tile.label, tile.value, tile.color]),
    [
      ['AQI · Good', 34, 'success'],
      ['PM2.5', 11, 'success'],
      ['Ozone', 34, 'success'],
      ['PM10', 15, 'success'],
    ],
  );
});

test('the Refresh button reads again only when AirNow may have something new', async (t) => {
  const { gladys, api, clock } = await startApp();
  t.after(() => gladys.fake.shutdown());
  api.calls.length = 0;
  const cached = await gladys.fake.widgetAction(
    WIDGETS.AIR_QUALITY,
    WIDGET_ACTIONS.REFRESH,
    {},
    { settings: { place: LA } },
  );
  assert.equal(cached.data.message.en, 'Already up to date: AirNow updates once an hour.');
  assert.equal(api.calls.length, 0);
  clock.now += 20 * MINUTE;
  const read = await gladys.fake.widgetAction(
    WIDGETS.FORECAST,
    WIDGET_ACTIONS.REFRESH,
    {},
    { settings: { place: LA } },
  );
  assert.equal(read.data.message.en, 'Read again: AQI 34.');
  assert.deepEqual(
    api.calls.map((call) => call.params.zipCode),
    ['90210'],
  );
});

test('places without data, without location, unknown, or a bad ZIP code are reported', async (t) => {
  const { gladys, app } = await startApp({
    config: { api_key: KEY, house_1: 'desert', house_2: 'nowhere', zip_3: '9021' },
  });
  t.after(() => gladys.fake.shutdown());
  assert.deepEqual(
    app.getPlaceErrors().map(({ slot, err }) => [slot, err.kind]),
    [
      [2, 'house_no_location'],
      [3, 'invalid_zip'],
    ],
  );
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.en, /^0 of 3 places read\./);
  const widget = await gladys.fake.widgetGet(WIDGETS.AIR_QUALITY, { language: 'fr' });
  assert.match(widget.data.content.components[0].text, /AirNow n’a pas de données près de Desert/);
  const read = await gladys.fake.action(ACTIONS.READ_NOW);
  assert.match(
    read.data.message.en,
    /AirNow has no data near Desert.*no location in Gladys.*“9021” is not a ZIP code/,
  );
});

test('a refused key stops the readings until the configuration changes', async (t) => {
  const { gladys, app, api, clock } = await startApp({ config: { ...CONFIG, api_key: 'wrong' } });
  t.after(() => gladys.fake.shutdown());
  assert.equal(api.calls.length, 1, 'the first refusal stops the round');
  assert.deepEqual(gladys.fake.connectionStatus, {
    connected: false,
    message: {
      en: 'AirNow refused the API key: check it on docs.airnowapi.org.',
      fr: 'AirNow a refusé la clé d’API : vérifiez-la sur docs.airnowapi.org.',
      de: 'AirNow hat den API-Schlüssel abgelehnt: prüfe ihn auf docs.airnowapi.org.',
      es: 'AirNow rechazó la clave de API: compruébela en docs.airnowapi.org.',
    },
  });
  clock.now += 2 * HOUR;
  await app.readPlaces();
  assert.equal(api.calls.length, 1);
  await gladys.fake.configUpdated({ ...CONFIG });
  assert.equal(gladys.fake.connectionStatus.connected, true);
});

test('offline: the error is reported, the next try waits 15 minutes', async (t) => {
  const api = fakeAirNow();
  api.offline = true;
  const { gladys, app, clock } = await startApp({ api });
  t.after(() => gladys.fake.shutdown());
  assert.match(gladys.fake.connectionStatus.message.en, /AirNow does not answer/);
  const tries = api.calls.length;
  clock.now += 5 * MINUTE;
  await app.readPlaces();
  assert.equal(api.calls.length, tries);
  api.offline = false;
  clock.now += 15 * MINUTE;
  await app.readPlaces();
  assert.equal(gladys.fake.connectionStatus.connected, true);
});

test('no key, no place: clear messages, no request', async (t) => {
  const { gladys, api } = await startApp({ config: {} });
  t.after(() => gladys.fake.shutdown());
  assert.deepEqual(api.calls, []);
  assert.match(gladys.fake.connectionStatus.message.en, /Enter your AirNow API key/);
  const widget = await gladys.fake.widgetGet(WIDGETS.FORECAST, { language: 'es' });
  assert.match(widget.data.content.components[0].text, /Introduzca su clave/);
  const second = await startApp({ config: { api_key: KEY } });
  t.after(() => second.gladys.fake.shutdown());
  assert.match(second.gladys.fake.connectionStatus.message.en, /Choose a house or a ZIP code/);
});

test('the diagnostic never writes the key', async (t) => {
  const logged = [];
  const gladys = createFakeGladys({ config: CONFIG, houses: HOUSES });
  createApp(gladys, {
    fetch: fakeAirNow(),
    storePath: storePath(),
    now: () => NOW,
    timeZone: TZ,
    timers: false,
    logger: { ...silent, info: (line) => logged.push(line) },
  });
  await gladys.connect();
  t.after(() => gladys.fake.shutdown());
  const answer = await gladys.fake.action(ACTIONS.DIAGNOSTIC);
  assert.match(answer.data.message.en, /Diagnostic written/);
  const report = logged.filter((line) => line.startsWith('AirNow diagnostic')).join('');
  assert.match(report, /"apiKey":"set"/);
  assert.doesNotMatch(report, new RegExp(KEY));
});
