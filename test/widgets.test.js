// The widget contents pass the validator of the SDK (what the core would
// drop or truncate), in every language and in their edge cases.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent, WIDGET_COLORS } from '@gladysassistant/integration-sdk';

import {
  buildAirQualityWidget,
  buildForecastWidget,
  messageContent,
  colorOf,
  whoColor,
} from '../src/widgets.js';
import { parseMeasurements, forecastPeak } from '../src/parse.js';
import { LEVEL_KEYS } from '../src/caqi.js';
import { LANGUAGES } from '../src/i18n.js';
import { fixture, rebase, NOW, TZ } from './helpers/fake-api.js';

const HOUR = 60 * 60 * 1000;
const assertValid = (content, label) => assert.deepEqual(validateWidgetContent(content), [], label);
const place = { name: 'Kraków, Mikołajska — a long name of a place to clip somewhere' };
const point = parseMeasurements(rebase(fixture('measurements_point.json')));
const sensor = parseMeasurements(rebase(fixture('measurements_installation.json')));

test('air quality: every level, every language, a sensor without weather, no reading', () => {
  for (const language of LANGUAGES) {
    for (const level of LEVEL_KEYS) {
      const content = buildAirQualityWidget({
        place,
        reading: { ...point, caqi: 420, level },
        language,
        timeZone: TZ,
      });
      assertValid(content, `${language} ${level}`);
      assert.ok(content.components.length <= 8);
    }
    assertValid(buildAirQualityWidget({ place, reading: sensor, language, timeZone: TZ }));
    assertValid(buildAirQualityWidget({ place, reading: null, language, timeZone: TZ }));
  }
});

test('air quality: CAQI tile in the color of its level, particles against the WHO values', () => {
  const content = buildAirQualityWidget({ place, reading: sensor, language: 'fr', timeZone: TZ });
  const tiles = content.components.filter((c) => c.type === 'value');
  assert.deepEqual(
    tiles.map((tile) => [tile.label, tile.value, tile.unit, tile.color]),
    [
      ['CAQI · Bonne', 44, undefined, WIDGET_COLORS.SUCCESS],
      ['PM2.5', '26,6', 'µg/m³', WIDGET_COLORS.WARNING],
      ['PM10', '29,4', 'µg/m³', WIDGET_COLORS.SUCCESS],
    ],
  );
  assert.match(content.components[0].text, /^Kraków, Mikołajska.* · Mesuré à \d\d:\d\d · Airly$/);
  assert.equal(whoColor(250), WIDGET_COLORS.DANGER);
  assert.equal(whoColor(undefined), undefined);
  assert.equal(colorOf('very_high'), WIDGET_COLORS.DANGER);
  assert.equal(colorOf(null), WIDGET_COLORS.NEUTRAL);
});

test('forecast: one chart of the last and next 24 hours, the peak, a warning when poor', () => {
  for (const language of LANGUAGES) {
    const content = buildForecastWidget({
      place,
      reading: point,
      peak: forecastPeak(point, NOW),
      language,
      timeZone: TZ,
      now: NOW,
    });
    assertValid(content, language);
    const chart = content.components.find((c) => c.type === 'chart');
    assert.equal(chart.series.length, 2);
    assert.equal(chart.series[0].points.length, 25, '24 hours and the hour now');
    assert.equal(chart.series[1].points[0].t, chart.series[0].points.at(-1).t, 'joined');
    assert.ok(!content.components.some((c) => c.variant === 'body'), 'no warning in clean air');
    const smog = {
      ...point,
      forecast: [{ at: NOW + 3 * HOUR, caqi: 110, pm25: 80, pm10: 120 }],
    };
    const warned = buildForecastWidget({
      place,
      reading: smog,
      peak: forecastPeak(smog, NOW),
      language,
      timeZone: TZ,
      now: NOW,
    });
    assertValid(warned, `${language} warning`);
    assert.ok(warned.components.some((c) => c.variant === 'body'));
    assertValid(
      buildForecastWidget({ place, reading: sensor, peak: null, language, timeZone: TZ, now: NOW }),
    );
  }
});

test('a message, with or without the Refresh button', () => {
  assertValid(messageContent('x'.repeat(400), { refresh: true }));
  assert.equal(messageContent('Hi').components.length, 1);
});
