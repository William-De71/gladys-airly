import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createAirlyClient,
  measurementsRequest,
  kindOf,
  AirlyError,
  NEAREST_KM,
} from '../src/airly-api.js';
import { fakeAirly, KEY, KRAKOW, INSTALLATION } from './helpers/fake-api.js';

const client = (api, key = KEY, usage = []) =>
  createAirlyClient({
    getApiKey: () => key,
    fetch: api,
    onUsage: (value) => usage.push(value),
  });

test('the request of a place: a sensor, a point, the nearest sensor', () => {
  assert.deepEqual(measurementsRequest({ installationId: 204 }), {
    path: '/v2/measurements/installation',
    query: { installationId: '204' },
  });
  assert.deepEqual(measurementsRequest({ ...KRAKOW, mode: 'point' }), {
    path: '/v2/measurements/point',
    query: { lat: '50.0620', lng: '19.9410' },
  });
  assert.deepEqual(measurementsRequest({ ...KRAKOW, mode: 'nearest' }), {
    path: '/v2/measurements/nearest',
    query: { lat: '50.0620', lng: '19.9410', maxDistanceKM: String(NEAREST_KM) },
  });
});

test('the key travels in a header, never in the URL; texts asked in English', async () => {
  const api = fakeAirly();
  const usage = [];
  const data = await client(api, KEY, usage).measurements({ installationId: INSTALLATION });
  assert.ok(data.current);
  const [call] = api.calls;
  assert.equal(call.headers.apikey, KEY);
  assert.equal(call.headers['accept-language'], 'en');
  assert.doesNotMatch(JSON.stringify(call.params), new RegExp(KEY));
  assert.deepEqual(usage, [{ limit: 100, remaining: 99 }]);
});

test('errors by kind: refused key, unknown sensor, nothing near, daily limit, offline', async () => {
  const api = fakeAirly();
  const kind = async (promise) => {
    try {
      await promise;
      return 'resolved';
    } catch (err) {
      assert.ok(err instanceof AirlyError);
      return err.kind;
    }
  };
  assert.equal(await kind(client(api, 'bad').measurements({ installationId: 1 })), 'auth');
  assert.equal(await kind(client(api, '').measurements({ installationId: 1 })), 'auth');
  assert.equal(await kind(client(api).measurements({ installationId: 999 })), 'not_found');
  assert.equal(
    await kind(client(api).measurements({ latitude: 0, longitude: 0, mode: 'nearest' })),
    'no_data',
  );
  api.remaining = 0;
  assert.equal(
    await kind(client(api).measurements({ installationId: INSTALLATION })),
    'rate_limit',
  );
  api.offline = true;
  assert.equal(await kind(client(api).installation(INSTALLATION)), 'unreachable');
  assert.equal(kindOf(400), 'invalid');
  assert.equal(kindOf(503), 'failed');
});

test('an installation and its address', async () => {
  const installation = await client(fakeAirly()).installation(INSTALLATION);
  assert.equal(installation.id, 204);
  assert.equal(installation.address.city, 'Kraków');
});
