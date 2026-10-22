// -----------------------------------------------------------------------------
// Configuration of the Airly integration.
//
// Fields of the config_schema:
//   - `api_key`          the Airly API key of the user (free, a `secret`:
//                        never sent back to the UI, never logged);
//   - `house_<n>`        a house of Gladys (`source: "houses"`, its selector):
//                        its coordinates locate the place;
//   - `installation_<n>` or the id of an Airly sensor (the number in the
//                        address of its page on the Airly map), which wins
//                        over the house;
//   - `house_mode`       how a house is read: `point` (the air quality
//                        interpolated by Airly at its coordinates) or
//                        `nearest` (the closest sensor, 3 km at most);
//   - `language`         language of the texts Gladys does not ask for in a
//                        language (device names, scene texts): `auto` follows
//                        the language of the last widget request.
// Up to three places (`<n>` from 1 to 3).
//
// Internal key, outside the config_schema (never shown in the UI):
//   - `last_language`    language of the last widget request.
// -----------------------------------------------------------------------------

import { isLanguage } from './i18n.js';

const MAX_PLACES = 3;
const AUTO_LANGUAGE = 'auto';
const HOUSE_MODES = ['point', 'nearest'];
const INTERNAL_KEYS = { language: 'last_language' };

const readString = (raw) =>
  typeof raw === 'string' ? raw.trim() : typeof raw === 'number' ? String(raw) : '';

/**
 * @description Read an installation id typed by hand.
 * @param {unknown} raw - "8077", 8077, or the address of its page
 * ("https://airly.org/map/en/#50.06,19.94,i8077").
 * @returns {number|null} The id, null when it is not one.
 * @example
 * readInstallationId('i8077'); // -> 8077
 */
function readInstallationId(raw) {
  const value = readString(raw);
  const match = /^i?(\d{1,9})$/i.exec(value) ?? /[,#/]i(\d{1,9})\/?$/i.exec(value);
  if (!match) {
    return null;
  }
  const id = Number.parseInt(match[1], 10);
  return id > 0 ? id : null;
}

/**
 * @description Normalize the raw config object from the host API.
 * @param {object} [rawConfig] - The raw config values.
 * @returns {object} `{ apiKey, places: [{ slot, installationId, house,
 * invalidInstallation }], houseMode, language }`; a slot without an
 * installation nor a house is left out.
 * @example
 * normalizeConfig({ api_key: 'k', installation_1: '8077' });
 */
function normalizeConfig(rawConfig = {}) {
  const config = rawConfig ?? {};
  const places = [];
  for (let slot = 1; slot <= MAX_PLACES; slot += 1) {
    const typed = readString(config[`installation_${slot}`]);
    const installationId = typed ? readInstallationId(typed) : null;
    const house = readString(config[`house_${slot}`]) || null;
    if (typed || house) {
      places.push({
        slot,
        installationId,
        house: installationId ? null : house,
        invalidInstallation: typed && !installationId ? typed.slice(0, 40) : null,
      });
    }
  }
  return {
    apiKey: readString(config.api_key),
    places,
    houseMode: HOUSE_MODES.includes(config.house_mode) ? config.house_mode : HOUSE_MODES[0],
    language: isLanguage(config.language) ? config.language : AUTO_LANGUAGE,
  };
}

/**
 * @description Read the stored language of the last request.
 * @param {object} [rawConfig] - The raw config values.
 * @param {string} fallback - The language to keep when nothing valid is stored.
 * @returns {string} The language.
 */
function readLanguage(rawConfig, fallback) {
  const language = (rawConfig ?? {})[INTERNAL_KEYS.language];
  return typeof language === 'string' && /^[a-z]{2}$/.test(language) ? language : fallback;
}

export {
  MAX_PLACES,
  AUTO_LANGUAGE,
  HOUSE_MODES,
  INTERNAL_KEYS,
  readInstallationId,
  normalizeConfig,
  readLanguage,
};
