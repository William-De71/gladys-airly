import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  dayKeyOf,
  detectCategoryChange,
  detectForecastChanges,
  detectActionDays,
  forecastData,
  changedData,
  pick,
  AIR_QUALITY_OUTPUTS,
} from '../src/events.js';
import { parseForecast, parseObservations } from '../src/parse.js';
import { fixture } from './helpers/fake-api.js';

const forecast = parseForecast(fixture('forecast_current__latlong.json'));
const place = { deviceId: 'ext:airnow:place:zip-94558', area: 'Napa' };

test('days and category changes', () => {
  assert.deepEqual(
    ['2026-09-08', '2026-09-09', '2026-09-10', '2026-09-14'].map((d) => dayKeyOf(d, '2026-09-09')),
    [null, 'today', 'tomorrow', 'later'],
  );
  assert.equal(detectCategoryChange(undefined, 'good'), null, 'baseline');
  assert.equal(detectCategoryChange('good', 'good'), null);
  assert.deepEqual(detectCategoryChange('good', 'unhealthy'), {
    direction: 'worse',
    previous: 'good',
  });
  assert.deepEqual(detectCategoryChange('unhealthy', 'moderate'), {
    direction: 'better',
    previous: 'unhealthy',
  });
});

test('forecast changes: a baseline, then the days that changed; past days forgotten', () => {
  const first = detectForecastChanges({ seen: undefined, forecast, today: '2026-09-09' });
  assert.deepEqual(first.changes, []);
  assert.equal(Object.keys(first.next).length, 6);
  const changed = structuredClone(forecast);
  changed.days[1].category = 'sensitive';
  const second = detectForecastChanges({
    seen: first.next,
    forecast: changed,
    today: '2026-09-10',
  });
  assert.deepEqual(
    second.changes.map((day) => day.date),
    ['2026-09-10'],
  );
  assert.equal(second.next['2026-09-09'], undefined);
});

test('action days: once each, even at the first reading', () => {
  const alert = structuredClone(forecast);
  alert.days[1].actionDay = true;
  const first = detectActionDays({ fired: undefined, forecast: alert, today: '2026-09-09' });
  assert.deepEqual(
    first.newly.map((day) => day.date),
    ['2026-09-10'],
  );
  assert.deepEqual(
    detectActionDays({ fired: first.next, forecast: alert, today: '2026-09-09' }).newly,
    [],
  );
});

test('payloads are flat, scalar and within the limits', () => {
  const observations = parseObservations(fixture('observation_current_ziplatLong__latlong.json'));
  const payloads = [
    changedData(place, observations, { direction: 'worse', previous: 'good' }, 'fr'),
    forecastData(place, { ...forecast.days[0], discussion: 'x'.repeat(3000) }, '2026-09-09', 'de'),
  ];
  for (const data of payloads) {
    assert.ok(Object.keys(data).length <= 30);
    for (const value of Object.values(data)) {
      assert.ok(value === null || ['string', 'number', 'boolean'].includes(typeof value));
      assert.ok(typeof value !== 'string' || value.length <= 1000);
    }
  }
  assert.equal(payloads[1].category_name, 'Mäßig');
  assert.deepEqual(
    Object.keys(pick({ aqi: 1, other: 2 }, AIR_QUALITY_OUTPUTS)),
    AIR_QUALITY_OUTPUTS,
  );
});
