// -----------------------------------------------------------------------------
// Scene triggers and scene action outputs.
//
// Triggers (one event per transition, never a periodic snapshot):
//   - `air_quality_changed`  the CAQI level now changes (Low -> Medium…),
//                            with its direction;
//   - `pollution_expected`   the forecast of the next 24 hours reaches a high
//                            or very high level: once per episode, again when
//                            it gets worse (high -> very high), armed again
//                            once the forecast falls back below high;
//   - `who_limit_exceeded`   PM2.5, PM10, NO2 or O3 of the last hour goes over
//                            the WHO guideline value; armed again below it.
// The first reading of a place is a baseline. `seen` lives in /data: a
// restart never fires twice. A scene action or a widget never fires an event.
// -----------------------------------------------------------------------------

import { rankOf, ALERT_LEVELS } from './caqi.js';
import { WHO_POLLUTANTS } from './parse.js';
import { levelText, pollutantText } from './i18n.js';
import { formatTime, hoursBetween } from './time.js';

const TRIGGERS = {
  AIR_QUALITY_CHANGED: 'air_quality_changed',
  POLLUTION_EXPECTED: 'pollution_expected',
  WHO_LIMIT_EXCEEDED: 'who_limit_exceeded',
};
const AIR_QUALITY_OUTPUTS = [
  'name',
  'caqi',
  'level',
  'level_name',
  'pm1',
  'pm25',
  'pm10',
  'temperature',
  'humidity',
  'pressure',
  'pm25_who_percent',
  'pm10_who_percent',
  'forecast_caqi',
  'forecast_level',
  'forecast_time',
  'summary',
];

/**
 * @description Whether the level now changed.
 * @param {string|null|undefined} previous - The level seen last, undefined at first.
 * @param {string|null} current - The level now.
 * @returns {{ direction: string, previous: string }|null} The change.
 */
function detectLevelChange(previous, current) {
  if (!previous || !current || previous === current) {
    return null;
  }
  return { direction: rankOf(current) > rankOf(previous) ? 'worse' : 'better', previous };
}

/**
 * @description Whether the forecast announces a new or worse episode.
 * @param {string|null|undefined} seen - The alert level in progress (null: none,
 * undefined: the first reading).
 * @param {object|null} peak - The forecast peak.
 * @returns {{ fire: boolean, next: string|null }} Fire or not, and what to remember.
 */
function detectForecastAlert(seen, peak) {
  const level = peak && ALERT_LEVELS.includes(peak.level) ? peak.level : null;
  if (seen === undefined || !level) {
    return { fire: false, next: level };
  }
  return { fire: rankOf(level) > rankOf(seen ?? null), next: level };
}

/**
 * @description The pollutants that went over their WHO guideline value.
 * @param {string[]|undefined} seen - The pollutants over it at the last reading
 * (undefined: the first reading).
 * @param {object} who - `{ pm25: { limit, percent } … }` of the reading.
 * @returns {{ newly: string[], next: string[] }} The new ones, and what to remember.
 */
function detectWhoExceeded(seen, who) {
  const next = WHO_POLLUTANTS.filter((key) => (who?.[key]?.percent ?? 0) > 100);
  if (seen === undefined) {
    return { newly: [], next };
  }
  return { newly: next.filter((key) => !seen.includes(key)), next };
}

/**
 * @description The data of an `air_quality_changed` event.
 * @param {object} place - `{ deviceId, name }`.
 * @param {object} reading - The reading.
 * @param {object} change - `{ direction, previous }`.
 * @param {string} language - The language of the texts.
 * @returns {object} The flat payload.
 */
function changedData(place, reading, change, language) {
  return {
    place: place.deviceId,
    name: place.name,
    caqi: reading.caqi,
    level: reading.level,
    level_name: levelText(reading.level, language),
    previous_level: change.previous,
    direction: change.direction,
    pm25: reading.values.pm25 ?? null,
    pm10: reading.values.pm10 ?? null,
  };
}

/**
 * @description The data of a `pollution_expected` event.
 * @param {object} place - `{ deviceId, name }`.
 * @param {object} reading - The reading.
 * @param {object} peak - The forecast peak.
 * @param {object} options - `{ language, timeZone, now }`.
 * @returns {object} The flat payload.
 */
function expectedData(place, reading, peak, { language, timeZone, now }) {
  return {
    place: place.deviceId,
    name: place.name,
    caqi: peak.caqi,
    level: peak.level,
    level_name: levelText(peak.level, language),
    time: formatTime(peak.at, { language, timeZone }),
    hours: hoursBetween(now, peak.at),
    current_caqi: reading.caqi,
  };
}

/**
 * @description The data of a `who_limit_exceeded` event.
 * @param {object} place - `{ deviceId, name }`.
 * @param {object} reading - The reading.
 * @param {string} pollutant - The pollutant key.
 * @param {string} language - The language of the texts.
 * @returns {object} The flat payload.
 */
function whoData(place, reading, pollutant, language) {
  return {
    place: place.deviceId,
    name: place.name,
    pollutant,
    pollutant_name: pollutantText(pollutant, language),
    value: reading.values[pollutant] ?? null,
    limit: reading.who[pollutant].limit,
    percent: reading.who[pollutant].percent,
  };
}

/**
 * @description Keep only the declared keys of a scene action result.
 * @param {object} outputs - The values.
 * @param {string[]} keys - The declared outputs.
 * @returns {object} The result.
 */
const pick = (outputs, keys) => Object.fromEntries(keys.map((key) => [key, outputs[key] ?? null]));

export {
  TRIGGERS,
  AIR_QUALITY_OUTPUTS,
  detectLevelChange,
  detectForecastAlert,
  detectWhoExceeded,
  changedData,
  expectedData,
  whoData,
  pick,
};
