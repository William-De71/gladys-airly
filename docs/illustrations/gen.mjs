// Builds the widget contents of the illustrations with the integration's own
// code: node gen.mjs <repo> <out.json> (run by render.sh)
//
// The two widgets for Napa, California, on 2026-09-09: the real answers of the
// AirNow API kept in test/fixtures (observations and a six-day forecast, the
// last four days with a category only) go through the real parsers
// (src/parse.js) and widget builders (src/widgets.js). The 08:00 observation
// is shown as read that morning; the forecast of tomorrow carries an
// illustrative air quality alert, so the card shows how one looks.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [repo, out] = process.argv.slice(2);
const load = (path) => import(pathToFileURL(`${repo}/${path}`).href);
const { buildAirQualityWidget, buildForecastWidget } = await load('src/widgets.js');
const { parseObservations, parseForecast } = await load('src/parse.js');
const { LANGUAGES } = await load('src/i18n.js');
const fixture = (name) => JSON.parse(readFileSync(`${repo}/test/fixtures/${name}`, 'utf8'));
const manifest = JSON.parse(readFileSync(`${repo}/gladys-assistant-integration.json`, 'utf8'));

// 2026-09-09, 08:40 in Napa (PDT).
const NOW = Date.parse('2026-09-09T15:40:00Z');
const TZ = 'America/Los_Angeles';

const observationRows = fixture('observation_current_ziplatLong__latlong.json').map((row) => ({
  ...row,
  dateObserved: '2026-09-09',
}));
const observations = parseObservations(observationRows, NOW);
const forecast = parseForecast(
  fixture('forecast_current__latlong.json').map((row) =>
    row.dateValid === '2026-09-10'
      ? {
          ...row,
          aqi: 112,
          categoryNumber: 3,
          categoryName: 'Unhealthy for Sensitive Groups',
          actionDay: true,
          discussion: 'Illustration: smoke from a distant wildfire may reach the valley.',
        }
      : row,
  ),
);
const place = { area: 'Napa', label: 'Napa' };

const contents = {};
for (const language of LANGUAGES) {
  contents[language] = {
    air_quality: buildAirQualityWidget({ place, observations, language, timeZone: TZ }),
    forecast: buildForecastWidget({ place, forecast, today: '2026-09-09', language }),
  };
}
const widgets = Object.fromEntries(
  manifest.widgets.map((w) => [w.key, { icon: w.icon, label: w.label }]),
);
writeFileSync(out, JSON.stringify({ now: NOW, widgets, contents }));
