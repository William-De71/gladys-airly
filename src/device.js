// -----------------------------------------------------------------------------
// The devices of the integration, offered on the Discovery screen.
//
// "Airly <place>": one per configured place. Read-only features (category /
// type pairs of the SDK constants, with an icon and a label in the front):
//   - `caqi`            airquality-sensor / aqi, 0-500: the CAQI now;
//   - `level`           text: "Medium", in the language of the integration;
//   - `pm25`, `pm10`    pm25-sensor / pm10-sensor, decimal, µg/m³;
//   - `forecast_caqi`   airquality-sensor / aqi: the highest CAQI expected
//                       within 24 hours;
//   - `forecast`        text: "Highest within 24 h: 62, Medium, at 18:00";
//   and, once the place gave them (they never go away afterwards: a feature
//   that flaps would ask the user to update the device):
//   - `temperature`, `humidity`, `pressure`  decimal, °C, %, hPa;
//   - `no2`, `o3`, `so2`                     decimal, µg/m³.
// PM1 has no category in Gladys (pm25-sensor would mislabel it), CO is a
// binary detector there: both stay in the widgets and the scene action.
//
// External ids: the place as configured — `place:installation-8077` or
// `place:house-<house selector>`, never a name. `should_poll` stays false:
// the integration reads on its own timer (the daily limit of the key).
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS as UNITS,
} from '@gladysassistant/integration-sdk';
import { t, levelText } from './i18n.js';
import { formatTime } from './time.js';

const DEVICE_TYPE = 'place';
const MAX_CAQI = 500;
const TEXT_MAX = 250;

const sensor = (category, type, unit, min, max) => ({
  category,
  type,
  unit,
  min,
  max,
  read_only: true,
  has_feedback: false,
  keep_history: true,
});
const caqiShape = sensor(
  CATEGORIES.AIRQUALITY_SENSOR,
  TYPES.AIRQUALITY_SENSOR.AQI,
  UNITS.AQI,
  0,
  MAX_CAQI,
);
const concentration = (category, max) =>
  sensor(category, TYPES.SENSOR.DECIMAL, UNITS.MICROGRAM_PER_CUBIC_METER, 0, max);
const textShape = {
  category: CATEGORIES.TEXT,
  type: TYPES.TEXT.TEXT,
  min: 0,
  max: 0,
  read_only: true,
  has_feedback: false,
  keep_history: false,
};
const value = (key) => (reading) => reading.values?.[key] ?? null;

// `always`: offered from the start; the others once the place gave them.
const FEATURES = [
  { key: 'caqi', name: 'featureCaqi', shape: caqiShape, always: true, state: (r) => r.caqi },
  { key: 'level', name: 'featureLevel', shape: textShape, always: true, text: true },
  {
    key: 'pm25',
    name: 'featurePm25',
    shape: concentration(CATEGORIES.PM25_SENSOR, 1000),
    always: true,
    state: value('pm25'),
  },
  {
    key: 'pm10',
    name: 'featurePm10',
    shape: concentration(CATEGORIES.PM10_SENSOR, 2000),
    always: true,
    state: value('pm10'),
  },
  {
    key: 'temperature',
    name: 'featureTemperature',
    shape: sensor(CATEGORIES.TEMPERATURE_SENSOR, TYPES.SENSOR.DECIMAL, UNITS.CELSIUS, -60, 60),
    state: value('temperature'),
  },
  {
    key: 'humidity',
    name: 'featureHumidity',
    shape: sensor(CATEGORIES.HUMIDITY_SENSOR, TYPES.SENSOR.DECIMAL, UNITS.PERCENT, 0, 100),
    state: value('humidity'),
  },
  {
    key: 'pressure',
    name: 'featurePressure',
    shape: sensor(CATEGORIES.PRESSURE_SENSOR, TYPES.SENSOR.DECIMAL, UNITS.HECTO_PASCAL, 800, 1100),
    state: value('pressure'),
  },
  {
    key: 'no2',
    name: 'featureNo2',
    shape: concentration(CATEGORIES.NO2_SENSOR, 2000),
    state: value('no2'),
  },
  {
    key: 'o3',
    name: 'featureO3',
    shape: concentration(CATEGORIES.O3_SENSOR, 2000),
    state: value('o3'),
  },
  {
    key: 'so2',
    name: 'featureSo2',
    shape: concentration(CATEGORIES.SO2_SENSOR, 2000),
    state: value('so2'),
  },
  {
    key: 'forecast_caqi',
    name: 'featureForecastCaqi',
    shape: caqiShape,
    always: true,
    peak: true,
    state: (r, peak) => peak?.caqi ?? null,
  },
  { key: 'forecast', name: 'featureForecast', shape: textShape, always: true, text: true, peak: true },
];
const FEATURE_KEYS = FEATURES.map((feature) => feature.key);
const OPTIONAL_KEYS = FEATURES.filter((feature) => !feature.always).map((feature) => feature.key);

/**
 * @description The key of a configured place.
 * @param {{ installationId: number|null, house: string|null }} place - The place.
 * @returns {string} "installation-8077", "house-main-house".
 */
function placeKey(place) {
  if (place.installationId) {
    return `installation-${place.installationId}`;
  }
  return `house-${String(place.house)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')}`;
}

/**
 * @description The external ids of a place.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {string} key - The place key.
 * @returns {{ device: string, feature: Function }} The ids.
 */
const idsOf = (gladys, key) => gladys.externalIds(DEVICE_TYPE, key);

/**
 * @description The place key of a device (or feature) external id.
 * @param {unknown} externalId - The id.
 * @returns {string|null} The key.
 * @example
 * keyOfExternalId('ext:airly:place:installation-8077:caqi'); // -> 'installation-8077'
 */
function keyOfExternalId(externalId) {
  const match = /:place:((?:installation|house)-[a-z0-9_-]+?)(?::[a-z_0-9]+)?$/.exec(
    String(externalId ?? ''),
  );
  return match ? match[1] : null;
}

/**
 * @description The optional features a reading gives.
 * @param {object|null} reading - The reading.
 * @returns {string[]} The feature keys.
 */
const optionalKeysOf = (reading) =>
  OPTIONAL_KEYS.filter((key) => Number.isFinite(reading?.values?.[key]));

/**
 * @description Build the device of a place.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} place - `{ key, installationId, house, mode, name, features }`:
 * `features` the optional feature keys the place ever gave.
 * @param {string} [language] - Language of the names.
 * @returns {object} The discovered device.
 */
function buildPlaceDevice(gladys, place, language = 'en') {
  const ids = idsOf(gladys, place.key);
  const optional = new Set(place.features ?? []);
  const params = place.installationId
    ? [{ name: 'AIRLY_INSTALLATION_ID', value: String(place.installationId) }]
    : [
        { name: 'AIRLY_HOUSE', value: place.house },
        { name: 'AIRLY_MODE', value: place.mode },
      ];
  return {
    name: t('deviceName', language, { name: place.name }),
    external_id: ids.device,
    model: 'Airly',
    should_poll: false,
    params,
    features: FEATURES.filter((feature) => feature.always || optional.has(feature.key)).map(
      (feature) => ({
        name: t(feature.name, language),
        external_id: ids.feature(feature.key),
        ...feature.shape,
      }),
    ),
  };
}

/**
 * @description The forecast text: "Highest within 24 h: 62, Medium, at 18:00".
 * @param {object|null} peak - The forecast peak (parse.js).
 * @param {string} language - The language.
 * @param {string} [timeZone] - IANA timezone.
 * @returns {string} The text, '' without a forecast.
 */
function forecastLine(peak, language, timeZone) {
  if (!peak) {
    return '';
  }
  return t('forecastText', language, {
    caqi: peak.caqi,
    level: levelText(peak.level, language),
    time: formatTime(peak.at, { language, timeZone }),
  });
}

/**
 * @description The states of a place. A value Airly did not give this time
 * is left untouched (a 0 would claim clean air).
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} place - `{ key, features }`.
 * @param {object} reading - The reading (parse.js).
 * @param {object|null} peak - The forecast peak.
 * @param {object} options - `{ language, timeZone }`.
 * @returns {object[]} `{ device_feature_external_id, state | text }`.
 */
function buildPlaceStates(gladys, place, reading, peak, { language, timeZone } = {}) {
  if (!reading) {
    return [];
  }
  const ids = idsOf(gladys, place.key);
  const optional = new Set(place.features ?? []);
  const states = [];
  for (const feature of FEATURES) {
    if (!feature.always && !optional.has(feature.key)) {
      continue;
    }
    const id = ids.feature(feature.key);
    if (feature.text) {
      const text =
        feature.key === 'level'
          ? levelText(reading.level, language)
          : forecastLine(peak, language, timeZone);
      if (text) {
        states.push({ device_feature_external_id: id, text: text.slice(0, TEXT_MAX) });
      }
      continue;
    }
    const state = feature.state(reading, peak);
    if (Number.isFinite(state)) {
      states.push({
        device_feature_external_id: id,
        state: Math.min(Math.max(state, feature.shape.min), feature.shape.max),
      });
    }
  }
  return states;
}

export {
  DEVICE_TYPE,
  FEATURES,
  FEATURE_KEYS,
  OPTIONAL_KEYS,
  MAX_CAQI,
  placeKey,
  idsOf,
  keyOfExternalId,
  optionalKeysOf,
  buildPlaceDevice,
  forecastLine,
  buildPlaceStates,
};
