// -----------------------------------------------------------------------------
// Airly answers -> plain readings.
//
// A measurements answer (`current`, `history`, `forecast`) becomes:
//   {
//     from, at,            the hour averaged (ms), `at` its end
//     caqi, level,         the CAQI rounded, its level (caqi.js)
//     values: { pm1, pm25, pm10, temperature, humidity, pressure, no2, o3, so2, co },
//     who: { pm25: { limit, percent }, … },  the WHO guideline values
//     history: [{ at, caqi }], forecast: [{ at, caqi, pm25, pm10 }],
//   }
// A value Airly did not give is absent, never 0 (a 0 would claim clean air).
// When no sensor is near the place, Airly answers 200 with a null index
// ("There are no Airly sensors in this area yet."): `parseMeasurements`
// throws an AirlyError `no_data`.
// -----------------------------------------------------------------------------

import { AirlyError } from './airly-api.js';
import { levelOf } from './caqi.js';

// Airly measurement names -> our keys.
const VALUE_KEYS = {
  PM1: 'pm1',
  PM25: 'pm25',
  PM10: 'pm10',
  TEMPERATURE: 'temperature',
  HUMIDITY: 'humidity',
  PRESSURE: 'pressure',
  NO2: 'no2',
  O3: 'o3',
  SO2: 'so2',
  CO: 'co',
};
const WHO_POLLUTANTS = ['pm25', 'pm10', 'no2', 'o3'];

const round1 = (value) => Math.round(value * 10) / 10;

/**
 * @description An instant of Airly.
 * @param {unknown} value - "2022-09-06T23:13:20.347Z".
 * @returns {number|null} The instant (ms).
 */
function instant(value) {
  const ms = Date.parse(String(value ?? ''));
  return Number.isFinite(ms) ? ms : null;
}

/**
 * @description The CAQI of an averaged period.
 * @param {object} period - `{ indexes }`.
 * @returns {number|null} The CAQI rounded, null when absent.
 */
function caqiOf(period) {
  const indexes = Array.isArray(period?.indexes) ? period.indexes : [];
  const index = indexes.find((entry) => /CAQI/i.test(String(entry?.name))) ?? indexes[0];
  return Number.isFinite(index?.value) ? Math.round(index.value) : null;
}

/**
 * @description The raw values of an averaged period.
 * @param {object} period - `{ values }`.
 * @returns {object} Our key -> value, rounded to a tenth.
 */
function valuesOf(period) {
  const values = {};
  for (const entry of Array.isArray(period?.values) ? period.values : []) {
    const key = VALUE_KEYS[String(entry?.name).toUpperCase()];
    if (key && Number.isFinite(entry.value)) {
      values[key] = round1(entry.value);
    }
  }
  return values;
}

/**
 * @description The WHO guideline values of an averaged period.
 * @param {object} period - `{ standards }`.
 * @returns {object} Our key -> `{ limit, percent }`.
 */
function whoOf(period) {
  const who = {};
  for (const entry of Array.isArray(period?.standards) ? period.standards : []) {
    const key = VALUE_KEYS[String(entry?.pollutant).toUpperCase()];
    if (
      WHO_POLLUTANTS.includes(key) &&
      /WHO/i.test(String(entry.name ?? 'WHO')) &&
      Number.isFinite(entry.percent) &&
      Number.isFinite(entry.limit)
    ) {
      who[key] = { limit: entry.limit, percent: Math.round(entry.percent) };
    }
  }
  return who;
}

/**
 * @description Parse a measurements answer.
 * @param {object} data - `{ current, history, forecast }`.
 * @returns {object} The reading.
 * @throws {AirlyError} `no_data` when Airly has nothing for the place.
 */
function parseMeasurements(data) {
  const current = data?.current ?? {};
  const caqi = caqiOf(current);
  const values = valuesOf(current);
  if (caqi === null && Object.keys(values).length === 0) {
    const index = current.indexes?.[0];
    throw new AirlyError('no_data', String(index?.description ?? 'No measurement').slice(0, 120));
  }
  const hours = (list, map) =>
    (Array.isArray(list) ? list : [])
      .map((period) => ({ at: instant(period?.tillDateTime), caqi: caqiOf(period), ...map(period) }))
      .filter((point) => point.at !== null && point.caqi !== null)
      .sort((a, b) => a.at - b.at);
  return {
    from: instant(current.fromDateTime),
    at: instant(current.tillDateTime),
    caqi,
    level: levelOf(caqi),
    values,
    who: whoOf(current),
    history: hours(data.history, () => ({})),
    forecast: hours(data.forecast, (period) => {
      const forecastValues = valuesOf(period);
      return { pm25: forecastValues.pm25 ?? null, pm10: forecastValues.pm10 ?? null };
    }),
  };
}

/**
 * @description The highest CAQI forecast from now on, within a window.
 * @param {object|null} reading - The reading.
 * @param {number} now - Now (ms).
 * @param {number} [windowMs] - How far ahead (24 h: the whole forecast).
 * @returns {{ caqi: number, level: string, at: number }|null} The peak, the earliest one on a tie.
 */
function forecastPeak(reading, now, windowMs = 24 * 60 * 60 * 1000) {
  let peak = null;
  for (const point of reading?.forecast ?? []) {
    if (point.at <= now || point.at > now + windowMs) {
      continue;
    }
    if (!peak || point.caqi > peak.caqi) {
      peak = { caqi: point.caqi, level: levelOf(point.caqi), at: point.at };
    }
  }
  return peak;
}

/**
 * @description The name of an installation, from its address.
 * @param {object} installation - An Airly installation.
 * @returns {object} `{ id, name, city, latitude, longitude, airly }`.
 */
function parseInstallation(installation) {
  const address = installation?.address ?? {};
  const parts = [
    address.displayAddress1 || address.city,
    address.displayAddress2 || [address.street, address.number].filter(Boolean).join(' '),
  ]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean);
  return {
    id: Number.isInteger(installation?.id) ? installation.id : null,
    name: [...new Set(parts)].join(', ').slice(0, 80),
    city: String(address.city ?? '').slice(0, 80),
    latitude: installation?.location?.latitude ?? null,
    longitude: installation?.location?.longitude ?? null,
    airly: installation?.airly === true,
  };
}

export {
  VALUE_KEYS,
  WHO_POLLUTANTS,
  instant,
  caqiOf,
  valuesOf,
  whoOf,
  parseMeasurements,
  forecastPeak,
  parseInstallation,
};
