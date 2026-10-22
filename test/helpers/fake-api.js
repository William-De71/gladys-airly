// A fake Airly API for the tests, served through the `fetch` option of the
// integration. Its answers are real ones of the Airly API v2:
//   - measurements_point.json, measurements_no_station.json: the fixtures of
//     the Home Assistant integration `airly` (Apache-2.0, home-assistant/core,
//     tests/components/airly/fixtures), a point in Kraków (2022-09-06) and a
//     point with no sensor around;
//   - measurements_installation.json, installations_nearest.json: the test
//     data of the Python library `airly` (MIT, ak-ambi/python-airly), the
//     installation 204 in Kraków (2019-02-13), whose forecast is not available.
// Their instants are moved so that the hour measured ends at NOW. Tests never
// touch the network.

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// 2026-10-22 18:20 in Warsaw (CEST): the hour measured ends at 16:20 UTC.
const NOW = Date.parse('2026-10-22T16:20:00Z');
const TZ = 'Europe/Warsaw';
const KEY = 'good-key';
const KRAKOW = { latitude: 50.062006, longitude: 19.940984 };
const NOWHERE = { latitude: 0, longitude: 0 };
const INSTALLATION = 204;

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8'));
const clone = (value) => JSON.parse(JSON.stringify(value));
const silent = { info() {}, warn() {}, error() {}, debug() {} };

/**
 * @description Move every instant of a measurements answer by whole hours,
 * so that the hour measured ends around `now`.
 * @param {object} data - The answer.
 * @param {number} now - The end of the hour measured (ms).
 * @returns {object} A copy.
 */
function rebase(data, now = NOW) {
  const copy = clone(data);
  // Whole hours: the forecast keeps its hours on the hour, like Airly's.
  const shift =
    Math.round((now - Date.parse(copy.current.tillDateTime)) / 3600000) * 3600000;
  const move = (period) => {
    for (const key of ['fromDateTime', 'tillDateTime']) {
      period[key] = new Date(Date.parse(period[key]) + shift).toISOString();
    }
  };
  move(copy.current);
  copy.history.forEach(move);
  copy.forecast.forEach(move);
  return copy;
}

/**
 * @description A temporary path for the file kept in /data.
 * @returns {string} The path.
 */
const storePath = () => join(mkdtempSync(join(tmpdir(), 'airly-')), 'airly.json');

/**
 * @description The fake API: answers by path, installation or coordinates.
 * @param {object} [options] - `{ limit }`: the daily limit of the key.
 * @returns {Function & { calls: object[], answers: object }} A `fetch`.
 */
function fakeAirly({ limit = 100 } = {}) {
  const answers = {
    point: rebase(fixture('measurements_point.json')),
    nowhere: rebase(fixture('measurements_no_station.json')),
    installation: rebase(fixture('measurements_installation.json')),
    info: fixture('installations_nearest.json'),
  };
  const calls = [];
  let remaining = limit;
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        'content-type': 'application/json',
        'x-ratelimit-limit-day': String(limit),
        'x-ratelimit-remaining-day': String(Math.max(0, remaining)),
      },
    });
  const fetch = async (url, init = {}) => {
    const target = new URL(url);
    const params = Object.fromEntries(target.searchParams);
    calls.push({ path: target.pathname, params, headers: init.headers });
    if (fetch.offline) {
      throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } });
    }
    if (init.headers?.apikey !== KEY) {
      return json({ message: 'UNAUTHORIZED' }, 401);
    }
    if (remaining <= 0) {
      return json({ message: 'API rate limit exceeded' }, 429);
    }
    remaining -= 1;
    const near = (point) =>
      Math.abs(Number(params.lat) - point.latitude) < 0.01 &&
      Math.abs(Number(params.lng) - point.longitude) < 0.01;
    switch (target.pathname) {
      case '/v2/measurements/installation':
        return Number(params.installationId) === INSTALLATION
          ? json(clone(answers.installation))
          : json({ message: 'Installation not found' }, 404);
      case '/v2/measurements/point':
        return json(clone(near(KRAKOW) ? answers.point : answers.nowhere));
      case '/v2/measurements/nearest':
        return near(KRAKOW)
          ? json(clone(answers.installation))
          : json({ message: 'No installation found' }, 404);
      case `/v2/installations/${INSTALLATION}`:
        return json(clone(answers.info));
      default:
        return json({ message: 'Not found' }, 404);
    }
  };
  fetch.calls = calls;
  fetch.answers = answers;
  fetch.offline = false;
  Object.defineProperty(fetch, 'remaining', {
    get: () => remaining,
    set: (value) => {
      remaining = value;
    },
  });
  return fetch;
}

export {
  NOW,
  TZ,
  KEY,
  KRAKOW,
  NOWHERE,
  INSTALLATION,
  silent,
  storePath,
  fixture,
  clone,
  rebase,
  fakeAirly,
};
