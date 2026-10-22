// The widget contents pass the validator of the SDK (what the core would
// drop or truncate), in every language and in their edge cases.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import {
  buildAirQualityWidget,
  buildForecastWidget,
  messageContent,
  colorOf,
} from '../src/widgets.js';
import { parseObservations, parseForecast } from '../src/parse.js';
import { CATEGORY_KEYS } from '../src/aqi.js';
import { LANGUAGES } from '../src/i18n.js';
import { fixture, TZ } from './helpers/fake-api.js';

const assertValid = (content, label) => assert.deepEqual(validateWidgetContent(content), [], label);
const place = { area: 'NW Coastal LA', label: 'ZIP 90210' };
const observations = parseObservations(fixture('observation_current_ziplatLong.json'));
const napa = parseForecast(fixture('forecast_current__latlong.json'));

test('air quality: every category, every language, missing pollutants, no observation', () => {
  for (const language of LANGUAGES) {
    for (const category of CATEGORY_KEYS) {
      const reading = {
        ...observations,
        category,
        aqi: 420,
        pollutants: { pm25: { aqi: 420, category } },
      };
      const content = buildAirQualityWidget({
        place,
        observations: reading,
        language,
        timeZone: TZ,
      });
      assertValid(content, `${language} ${category}`);
      assert.ok(content.components.length <= 8);
    }
    assertValid(
      buildAirQualityWidget({ place, observations: null, language, timeZone: TZ }),
      language,
    );
  }
  const content = buildAirQualityWidget({ place, observations, language: 'en', timeZone: TZ });
  assert.equal(content.components[0].text, 'NW Coastal LA · Observed 5:00 PM');
  assert.match(
    content.components.find((c) => c.variant === 'body').text,
    /Preliminary data: South Coast AQMD via U\.S\. EPA AirNow\.$/,
  );
});

test('forecast: six days, alerts in the body, nothing issued', () => {
  const alert = structuredClone(napa);
  alert.days[0] = {
    ...alert.days[0],
    actionDay: true,
    category: 'unhealthy',
    discussion: 'Smoke from the north.',
  };
  for (const language of LANGUAGES) {
    for (const forecast of [napa, alert, null]) {
      const content = buildForecastWidget({ place, forecast, today: '2026-09-09', language });
      assertValid(content, language);
      assert.ok(content.components.filter((c) => c.type === 'text').length <= 2);
    }
  }
  const content = buildForecastWidget({
    place,
    forecast: alert,
    today: '2026-09-09',
    language: 'en',
  });
  const list = content.components.find((c) => c.type === 'card-list');
  assert.equal(list.items[0].title, 'Today · ⚠ air quality alert');
  assert.equal(list.items[0].badge.color, 'danger');
  assert.match(list.items[0].description, /Smoke from the north\.$/);
  assert.match(
    content.components.find((c) => c.variant === 'body').text,
    /^Air quality alert announced for today:/,
  );
  const later = buildForecastWidget({ place, forecast: napa, today: '2026-09-13', language: 'en' });
  assert.equal(
    later.components.find((c) => c.type === 'card-list').items.length,
    2,
    'past days dropped',
  );
});

test('colors and messages', () => {
  assert.deepEqual(CATEGORY_KEYS.map(colorOf), [
    'success',
    'warning',
    'warning',
    'danger',
    'danger',
    'danger',
  ]);
  assertValid(messageContent('x'.repeat(500), { refresh: true }), 'message');
});
