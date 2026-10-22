// The whole integration against the fake Gladys of the SDK
// (`@gladysassistant/integration-sdk/testing`), which checks the discovered
// devices, the states and the scene events like the host API does, and a fake
// Airly API serving real answers of the API v2.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import { createApp, SCENE_ACTIONS, ACTIONS } from '../src/app.js';
import { WIDGETS, WIDGET_ACTIONS } from '../src/widgets.js';
import { TRIGGERS } from '../src/events.js';
import {
  fakeAirly,
  storePath,
  silent,
  rebase,
  fixture,
  NOW,
  TZ,
  KEY,
  KRAKOW,
  NOWHERE,
} from './helpers/fake-api.js';

const CONFIG = { api_key: KEY, house_1: 'home', installation_2: '204', language: 'en' };
const HOUSES = [
  { selector: 'home', name: 'Home', ...KRAKOW },
  { selector: 'cabin', name: 'Cabin', ...NOWHERE },
  { selector: 'nowhere', name: 'No location' },
];
const PREFIX = 'ext:test-integration';
const HOME = `${PREFIX}:place:house-home`;
const SENSOR = `${PREFIX}:place:installation-204`;
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/**
 * @description The integration, connected to a fake Gladys and a fake API.
 * @param {object} [options] - `{ config, api, path, now, logger }`.
 * @returns {Promise<object>} `{ gladys, app, api, clock, path }`.
 */
async function startApp({
  config = CONFIG,
  api = fakeAirly(),
  path = storePath(),
  now = NOW,
  logger = silent,
} = {}) {
  const clock = { now };
  const gladys = createFakeGladys({ config, houses: HOUSES });
  const app = createApp(gladys, {
    fetch: api,
    storePath: path,
    now: () => clock.now,
    timeZone: TZ,
    timers: false,
    logger,
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
const paths = (api) => api.calls.map((call) => call.path);

test('a house and a sensor become two devices; one request per place, the address once', async (t) => {
  const { gladys, api } = await startApp();
  t.after(() => gladys.fake.shutdown());
  assert.deepEqual(
    gladys.fake.discoveredDevices.map((device) => [device.external_id, device.name]),
    [
      [HOME, 'Airly Home'],
      [SENSOR, 'Airly Kraków, Mikołajska'],
    ],
  );
  assert.deepEqual(paths(api), [
    '/v2/measurements/point',
    '/v2/installations/204',
    '/v2/measurements/installation',
  ]);
  assert.deepEqual(api.calls[0].params, { lat: '50.0620', lng: '19.9410' });
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.equal(
    gladys.fake.connectionStatus.message.en,
    'Connected to Airly: Home CAQI 7 (Very good), Kraków, Mikołajska CAQI 44 (Good). 3/100 requests today.',
  );
  // First readings: a baseline, no event.
  assert.deepEqual(gladys.fake.sceneEvents, []);
});

test('created devices get every value the place gave, the level and the forecast', async (t) => {
  const { gladys } = await startApp();
  t.after(() => gladys.fake.shutdown());
  await created(gladys, HOME);
  const state = (key) => gladys.fake.lastState(`${HOME}:${key}`);
  assert.equal(state('caqi'), 7);
  assert.equal(state('level'), 'Very good');
  assert.equal(state('pm25'), 4.4);
  assert.equal(state('pm10'), 6.1);
  assert.equal(state('temperature'), 14.4);
  assert.equal(state('humidity'), 68.4);
  assert.equal(state('pressure'), 1019.9);
  assert.equal(state('no2'), 16);
  assert.equal(state('forecast_caqi'), 23);
  assert.equal(state('forecast'), 'Highest within 24 h: 23, Very good, at 3:00 PM');
  await created(gladys, SENSOR);
  assert.equal(gladys.fake.lastState(`${SENSOR}:caqi`), 44);
  assert.equal(gladys.fake.lastState(`${SENSOR}:forecast`), undefined, 'no forecast for 204');
});

test('the plan: a round every 50 minutes for two places with a free key, never sooner', async (t) => {
  const { gladys, app, api, clock } = await startApp();
  t.after(() => gladys.fake.shutdown());
  api.calls.length = 0;
  clock.now += 25 * MINUTE;
  await app.readPlaces();
  assert.equal(api.calls.length, 0);
  clock.now += 5 * MINUTE; // 30 minutes: 90 requests / 2 places = 45 rounds, every 32 min -> 35
  await app.readPlaces();
  assert.equal(api.calls.length, 0);
  clock.now += 5 * MINUTE;
  await app.readPlaces();
  assert.deepEqual(paths(api), ['/v2/measurements/point', '/v2/measurements/installation']);
});

test('the reserve: no automatic reading once only it remains; the user may still read', async (t) => {
  const { gladys, app, api, clock } = await startApp();
  t.after(() => gladys.fake.shutdown());
  app.store.data.usage.count = 91;
  api.calls.length = 0;
  clock.now += 3 * HOUR;
  await app.readPlaces();
  assert.equal(api.calls.length, 0);
  const read = await gladys.fake.action(ACTIONS.READ_NOW);
  assert.match(read.data.message.en, /^Read now: Home CAQI 7/);
  assert.equal(api.calls.length, 2);
});

test('a 429: no request until midnight UTC, then the readings resume', async (t) => {
  const { gladys, app, api, clock } = await startApp();
  t.after(() => gladys.fake.shutdown());
  api.remaining = 0;
  clock.now += 2 * HOUR;
  await app.readPlaces();
  assert.match(gladys.fake.connectionStatus.message.en, /daily limit of the key is reached/);
  const calls = api.calls.length;
  clock.now += 2 * HOUR;
  await app.readPlaces();
  const refused = await gladys.fake.widgetAction(
    WIDGETS.AIR_QUALITY,
    WIDGET_ACTIONS.REFRESH,
    {},
    { settings: {} },
  );
  assert.match(refused.data.message.en, /daily limit/);
  assert.equal(api.calls.length, calls);
  api.remaining = 100;
  clock.now = Date.parse('2026-10-23T00:05:00Z');
  await app.readPlaces();
  assert.equal(api.calls.length, calls + 2);
  assert.equal(gladys.fake.connectionStatus.message.en.endsWith('2/100 requests today.'), true);
});

test('a level change fires air_quality_changed once; a restart fires nothing again', async (t) => {
  const { gladys, app, api, clock, path } = await startApp();
  t.after(() => gladys.fake.shutdown());
  const worse = rebase(fixture('measurements_installation.json'), NOW + HOUR);
  worse.current.indexes[0].value = 81.2;
  api.answers.installation = worse;
  clock.now += HOUR;
  await app.readPlaces();
  assert.deepEqual(eventsOf(gladys, TRIGGERS.AIR_QUALITY_CHANGED), [
    {
      key: TRIGGERS.AIR_QUALITY_CHANGED,
      data: {
        place: SENSOR,
        name: 'Kraków, Mikołajska',
        caqi: 81,
        level: 'high',
        level_name: 'Poor',
        previous_level: 'low',
        direction: 'worse',
        pm25: 26.6,
        pm10: 29.4,
      },
    },
  ]);
  clock.now += HOUR;
  await app.readPlaces();
  assert.equal(eventsOf(gladys, TRIGGERS.AIR_QUALITY_CHANGED).length, 1, 'same level: nothing');
  await gladys.fake.shutdown();
  const again = await startApp({ api, path, now: clock.now });
  t.after(() => again.gladys.fake.shutdown());
  assert.deepEqual(again.gladys.fake.sceneEvents, []);
});

test('a poor forecast fires pollution_expected once per episode', async (t) => {
  const { gladys, app, api, clock } = await startApp();
  t.after(() => gladys.fake.shutdown());
  const smog = rebase(fixture('measurements_point.json'), NOW + HOUR);
  smog.forecast[5].indexes[0].value = 88;
  api.answers.point = smog;
  clock.now += HOUR;
  await app.readPlaces();
  const [event] = eventsOf(gladys, TRIGGERS.POLLUTION_EXPECTED);
  assert.deepEqual(event.data, {
    place: HOME,
    name: 'Home',
    caqi: 88,
    level: 'high',
    level_name: 'Poor',
    time: '1:00 AM',
    hours: 6,
    current_caqi: 7,
  });
  clock.now += HOUR;
  await app.readPlaces();
  assert.equal(eventsOf(gladys, TRIGGERS.POLLUTION_EXPECTED).length, 1, 'same episode');
});

test('PM2.5 over the WHO guideline fires who_limit_exceeded once', async (t) => {
  const { gladys, app, api, clock } = await startApp();
  t.after(() => gladys.fake.shutdown());
  const dusty = rebase(fixture('measurements_point.json'), NOW + HOUR);
  dusty.current.standards[0].percent = 180.4;
  dusty.current.values[1].value = 27.06;
  api.answers.point = dusty;
  clock.now += HOUR;
  await app.readPlaces();
  assert.deepEqual(
    eventsOf(gladys, TRIGGERS.WHO_LIMIT_EXCEEDED).map((event) => event.data),
    [
      {
        place: HOME,
        name: 'Home',
        pollutant: 'pm25',
        pollutant_name: 'PM2.5',
        value: 27.1,
        limit: 15,
        percent: 180,
      },
    ],
  );
  clock.now += HOUR;
  await app.readPlaces();
  assert.equal(eventsOf(gladys, TRIGGERS.WHO_LIMIT_EXCEEDED).length, 1);
});

test('the scene action reads a place and gives a sentence, without firing an event', async (t) => {
  const { gladys, api, clock } = await startApp({ config: { ...CONFIG, language: 'fr' } });
  t.after(() => gladys.fake.shutdown());
  const answer = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_AIR_QUALITY, { place: HOME });
  assert.deepEqual(answer.data.outputs, {
    name: 'Home',
    caqi: 7,
    level: 'very_low',
    level_name: 'Très bonne',
    pm1: 2.8,
    pm25: 4.4,
    pm10: 6.1,
    temperature: 14.4,
    humidity: 68.4,
    pressure: 1019.9,
    pm25_who_percent: 29,
    pm10_who_percent: 15,
    forecast_caqi: 23,
    forecast_level: 'very_low',
    forecast_time: '15:00',
    summary:
      'Qualité de l’air à Home : Très bonne, CAQI 7, PM2,5 4,4 µg/m³. Maximum sous 24 heures : très bonne (23) à 15:00.',
  });
  // Past an hour, the action reads again on the reserve, and stays quiet.
  const worse = rebase(fixture('measurements_point.json'), NOW + 2 * HOUR);
  worse.current.indexes[0].value = 60;
  api.answers.point = worse;
  clock.now += 2 * HOUR;
  const again = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_AIR_QUALITY, { place: HOME });
  assert.equal(again.data.outputs.caqi, 60);
  assert.equal(eventsOf(gladys, TRIGGERS.AIR_QUALITY_CHANGED).length, 1);
});

test('widgets: valid contents in every language, for both places; they never read', async (t) => {
  const { gladys, api } = await startApp();
  t.after(() => gladys.fake.shutdown());
  const calls = api.calls.length;
  for (const language of ['en', 'fr', 'de', 'es']) {
    for (const key of Object.values(WIDGETS)) {
      for (const place of [undefined, HOME, SENSOR]) {
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
  assert.equal(api.calls.length, calls);
  const now = await gladys.fake.widgetGet(WIDGETS.AIR_QUALITY, { language: 'en' });
  assert.deepEqual(
    now.data.content.components
      .filter((c) => c.type === 'value')
      .map((tile) => [tile.label, tile.value]),
    [
      ['CAQI · Very good', 7],
      ['PM1', '2.8'],
      ['PM2.5', '4.4'],
      ['PM10', '6.1'],
      ['Temperature', '14.4'],
    ],
  );
  const forecast = await gladys.fake.widgetGet(WIDGETS.FORECAST, {
    language: 'en',
    settings: { place: SENSOR },
  });
  assert.match(forecast.data.content.components[1].text, /No forecast for this place yet/);
});

test('the Refresh button reads again only past 15 minutes', async (t) => {
  const { gladys, api, clock } = await startApp();
  t.after(() => gladys.fake.shutdown());
  api.calls.length = 0;
  const cached = await gladys.fake.widgetAction(
    WIDGETS.AIR_QUALITY,
    WIDGET_ACTIONS.REFRESH,
    {},
    { settings: { place: HOME } },
  );
  assert.match(cached.data.message.en, /^Already up to date/);
  assert.equal(api.calls.length, 0);
  clock.now += 20 * MINUTE;
  const read = await gladys.fake.widgetAction(
    WIDGETS.FORECAST,
    WIDGET_ACTIONS.REFRESH,
    {},
    { settings: { place: HOME } },
  );
  assert.equal(read.data.message.en, 'Read again: CAQI 7.');
  assert.equal(api.calls.length, 2, 'one round: every place');
});

test('places without sensor, without location, unknown, or a bad number are reported', async (t) => {
  const { gladys, app } = await startApp({
    config: { api_key: KEY, house_1: 'cabin', house_2: 'nowhere', installation_3: 'Kraków' },
  });
  t.after(() => gladys.fake.shutdown());
  assert.deepEqual(
    app.getPlaceErrors().map(({ slot, err }) => [slot, err.kind]),
    [
      [2, 'house_no_location'],
      [3, 'invalid_installation'],
    ],
  );
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.en, /^0 of 3 places read\./);
  assert.deepEqual(
    gladys.fake.discoveredDevices.map((d) => d.features.length),
    [6],
  );
  const widget = await gladys.fake.widgetGet(WIDGETS.AIR_QUALITY, { language: 'fr' });
  assert.match(
    widget.data.content.components[0].text,
    /Airly n’a pas encore de capteur près de Cabin/,
  );
  const read = await gladys.fake.action(ACTIONS.READ_NOW);
  assert.match(
    read.data.message.en,
    /no sensor near Cabin.*no location in Gladys.*“Kraków” is not an Airly sensor number/,
  );
});

test('a sensor without a recent measurement is reported as offline', async (t) => {
  const api = fakeAirly();
  api.answers.installation = rebase(fixture('measurements_no_station.json'));
  const { gladys } = await startApp({ api, config: { api_key: KEY, installation_1: '204' } });
  t.after(() => gladys.fake.shutdown());
  assert.match(
    gladys.fake.connectionStatus.message.en,
    /The sensor Kraków, Mikołajska sent no recent measurement/,
  );
});

test('an unknown sensor, and the nearest sensor of a house', async (t) => {
  const { gladys, api } = await startApp({
    config: { api_key: KEY, installation_1: '999', house_2: 'home', house_mode: 'nearest' },
  });
  t.after(() => gladys.fake.shutdown());
  assert.ok(paths(api).includes('/v2/measurements/nearest'));
  assert.match(gladys.fake.connectionStatus.message.en, /does not know the sensor #999/);
  assert.equal(gladys.fake.connectionStatus.connected, true, 'one place of two read');
});

test('a refused key stops the readings until the configuration changes', async (t) => {
  const { gladys, app, api, clock } = await startApp({ config: { ...CONFIG, api_key: 'wrong' } });
  t.after(() => gladys.fake.shutdown());
  assert.equal(api.calls.length, 1, 'the first refusal stops the round');
  assert.deepEqual(gladys.fake.connectionStatus, {
    connected: false,
    message: {
      en: 'Airly refused the API key: check it on developer.airly.org.',
      fr: 'Airly a refusé la clé d’API : vérifiez-la sur developer.airly.org.',
      de: 'Airly hat den API-Schlüssel abgelehnt: prüfe ihn auf developer.airly.org.',
      es: 'Airly rechazó la clave de API: compruébela en developer.airly.org.',
    },
  });
  clock.now += 2 * HOUR;
  await app.readPlaces();
  assert.equal(api.calls.length, 1);
  await gladys.fake.configUpdated({ ...CONFIG });
  assert.equal(gladys.fake.connectionStatus.connected, true);
});

test('offline: the error is reported, the next try waits 15 minutes', async (t) => {
  const api = fakeAirly();
  api.offline = true;
  const { gladys, app, clock } = await startApp({ api });
  t.after(() => gladys.fake.shutdown());
  assert.match(gladys.fake.connectionStatus.message.en, /Airly does not answer/);
  const tries = api.calls.length;
  clock.now += 5 * MINUTE;
  await app.readPlaces();
  assert.equal(api.calls.length, tries);
  api.offline = false;
  clock.now += 15 * MINUTE;
  await app.readPlaces();
  assert.equal(gladys.fake.connectionStatus.connected, true);
});

test('a restart reads nothing fresh: the readings and the usage are kept in /data', async (t) => {
  const { gladys, api, clock, path } = await startApp();
  await gladys.fake.shutdown();
  const calls = api.calls.length;
  clock.now += 10 * MINUTE;
  const again = await startApp({ api, path, now: clock.now });
  t.after(() => again.gladys.fake.shutdown());
  assert.equal(api.calls.length, calls);
  assert.equal(again.app.store.data.usage.count, 3);
  assert.equal(again.gladys.fake.connectionStatus.connected, true);
});

test('no key, no place: clear messages, no request', async (t) => {
  const { gladys, api } = await startApp({ config: {} });
  t.after(() => gladys.fake.shutdown());
  assert.deepEqual(api.calls, []);
  assert.match(gladys.fake.connectionStatus.message.en, /Enter your Airly API key/);
  const widget = await gladys.fake.widgetGet(WIDGETS.FORECAST, { language: 'es' });
  assert.match(widget.data.content.components[0].text, /Introduzca su clave/);
  const second = await startApp({ config: { api_key: KEY } });
  t.after(() => second.gladys.fake.shutdown());
  assert.match(second.gladys.fake.connectionStatus.message.en, /Choose a house or an Airly sensor/);
  assert.deepEqual(second.api.calls, []);
});

test('the diagnostic never writes the key nor the coordinates', async (t) => {
  const logged = [];
  const { gladys } = await startApp({
    logger: { ...silent, info: (line) => logged.push(line) },
  });
  t.after(() => gladys.fake.shutdown());
  const answer = await gladys.fake.action(ACTIONS.DIAGNOSTIC);
  assert.match(answer.data.message.en, /Diagnostic written/);
  const report = logged.filter((line) => line.startsWith('Airly diagnostic')).join('');
  assert.match(report, /"apiKey":"set"/);
  assert.match(report, /"intervalMinutes":35/);
  assert.doesNotMatch(report, new RegExp(KEY));
  assert.doesNotMatch(report, /50\.06|19\.94/);
});
