// Builds the widget contents of the illustrations with the integration's own
// code: node gen.mjs <repo> <out.json> (run by render.sh)
//
// The two widgets for a house in Kraków, on 2026-10-22 at 18:20: the real
// answers of the Airly API kept in test/fixtures go through the real parser
// (src/parse.js) and widget builders (src/widgets.js). The hour now combines
// the particles of the sensor 204 with the weather of the point answer; the
// forecast is the one of the point answer, raised in the evening for the
// illustration (a winter smog episode), so the card shows its warning.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [repo, out] = process.argv.slice(2);
const load = (path) => import(pathToFileURL(`${repo}/${path}`).href);
const { buildAirQualityWidget, buildForecastWidget } = await load('src/widgets.js');
const { parseMeasurements, forecastPeak } = await load('src/parse.js');
const { LANGUAGES } = await load('src/i18n.js');
const { rebase, fixture, NOW, TZ } = await load('test/helpers/fake-api.js');
const manifest = JSON.parse(readFileSync(`${repo}/gladys-assistant-integration.json`, 'utf8'));

const point = rebase(fixture('measurements_point.json'));
const sensor = rebase(fixture('measurements_installation.json'));
// The particles and index of the sensor, the weather of the point.
point.current.indexes = sensor.current.indexes;
point.current.standards = sensor.current.standards;
point.current.values = [
  { name: 'PM1', value: 18.2 },
  ...sensor.current.values.filter((value) => value.name !== 'NO2'),
  ...point.current.values.filter((value) =>
    ['TEMPERATURE', 'HUMIDITY', 'PRESSURE'].includes(value.name),
  ),
];
point.history.forEach((hour, index) => {
  hour.indexes[0].value = sensor.history[index].indexes[0].value;
});
// Illustration: the evening smog of a cold day.
point.forecast.forEach((hour, index) => {
  hour.indexes[0].value = Math.min(105, 40 + hour.indexes[0].value * (index < 12 ? 1 : 3));
});
const reading = parseMeasurements(point);
const peak = forecastPeak(reading, NOW);
const place = { name: 'Home' };

const contents = {};
for (const language of LANGUAGES) {
  contents[language] = {
    air_quality: buildAirQualityWidget({ place, reading, language, timeZone: TZ }),
    forecast: buildForecastWidget({ place, reading, peak, language, timeZone: TZ, now: NOW }),
  };
}
const widgets = Object.fromEntries(
  manifest.widgets.map((w) => [w.key, { icon: w.icon, label: w.label }]),
);
writeFileSync(out, JSON.stringify({ now: NOW, widgets, contents }));
