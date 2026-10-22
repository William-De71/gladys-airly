// -----------------------------------------------------------------------------
// The Airly integration: every handler, registered on a Gladys client.
//
// Brings the air quality measured by Airly (a network of sensors in Poland
// and across Europe) into Gladys, for up to three places — a house of Gladys
// or an Airly sensor — through the Airly API (a free key per user):
//   - devices (device.js): one per place, with the CAQI, its level, PM2.5,
//     PM10, the forecast peak, and the weather and gases the place gives;
//   - scene triggers (events.js): air quality changed, pollution expected,
//     WHO guideline value exceeded;
//   - scene action: read the air quality of a place;
//   - dashboard widgets (widgets.js): air quality now, forecast.
//
// One request per place gives the hour now, the last 24 hours and the next
// 24 hours. A free key allows 100 requests a day: the integration reads every
// place in the same round, as often as the limit allows (usage.js: every 30
// minutes at most, 50 minutes with three places), on its own timer, never on a
// Gladys poll. Readings are kept in /data, so a restart reads nothing that is
// still fresh. Transport: cloud only.
//
// index.js only creates the SDK client; the tests drive this module with the
// fake Gladys of the SDK and a fake Airly API (test/helpers/fake-api.js).
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { logger as sdkLogger } from '@gladysassistant/integration-sdk';
import { normalizeConfig, readLanguage, INTERNAL_KEYS, AUTO_LANGUAGE } from './config.js';
import { createAirlyClient, AirlyError } from './airly-api.js';
import { parseMeasurements, parseInstallation, forecastPeak } from './parse.js';
import { createStore, DEFAULT_PATH } from './store.js';
import { usageOf, limitOf, planInterval, mayRequest, remainingOf } from './usage.js';
import {
  placeKey,
  idsOf,
  keyOfExternalId,
  optionalKeysOf,
  buildPlaceDevice,
  buildPlaceStates,
} from './device.js';
import {
  TRIGGERS,
  AIR_QUALITY_OUTPUTS,
  detectLevelChange,
  detectForecastAlert,
  detectWhoExceeded,
  changedData,
  expectedData,
  whoData,
  pick,
} from './events.js';
import {
  WIDGETS,
  WIDGET_ACTIONS,
  TTL_SECONDS,
  messageContent,
  buildAirQualityWidget,
  buildForecastWidget,
} from './widgets.js';
import { defaultTimeZone, formatTime, msToUtcMidnight, MINUTE_MS, DAY_MS } from './time.js';
import { t, all, levelText, LANGUAGES } from './i18n.js';

const ACTIONS = { READ_NOW: 'read_now', DIAGNOSTIC: 'diagnostic' };
const SCENE_ACTIONS = { GET_AIR_QUALITY: 'get_air_quality' };
const TICK_MS = 5 * MINUTE_MS;
const RETRY_MS = 15 * MINUTE_MS;
// The address of a sensor rarely changes: read again once a week.
const INSTALLATION_EVERY_MS = 7 * DAY_MS;
// A scene action or a widget reuses a reading younger than this.
const FRESH_MS = 60 * MINUTE_MS;
// The Refresh button reads again past this age.
const REFRESH_MIN_AGE_MS = 15 * MINUTE_MS;
const DIAGNOSTIC_CHUNK = 3000;
const { version: VERSION } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

/**
 * @description Register every handler of the integration on a Gladys client.
 * @param {object} gladys - A GladysIntegration (or the fake Gladys of the SDK).
 * @param {object} [options] - Options.
 * @param {Function} [options.fetch] - HTTP transport of the Airly API (tests).
 * @param {string} [options.baseUrl] - The API root (tests).
 * @param {string} [options.storePath] - The file kept in /data.
 * @param {Function} [options.now] - `() => number` in ms (tests).
 * @param {string} [options.timeZone] - IANA timezone of the texts (TZ by default).
 * @param {boolean} [options.timers] - Arm the reading timer (false in tests).
 * @param {object} [options.logger] - Logger.
 * @returns {object} Handles for the tests.
 */
function createApp(
  gladys,
  {
    fetch: fetchFn,
    baseUrl,
    storePath = DEFAULT_PATH,
    now = () => Date.now(),
    timeZone = defaultTimeZone(),
    timers = true,
    logger = sdkLogger,
  } = {},
) {
  let config = normalizeConfig();
  let language = 'en';
  let createdDevices = new Set();
  // The configured places, resolved: `{ slot, key, installationId, house,
  // mode, where, name, deviceId }`; and the errors of the places that could not be.
  let places = [];
  let placeErrors = [];
  let authError = null;
  let lastStatus = null;
  let lastDiscovery = null;
  let timer = null;
  let reading = null;
  let stopped = false;

  const store = createStore({ path: storePath, logger });

  /**
   * @description The usage of the key today (reset at midnight UTC).
   * @returns {object} The usage record, kept in the store.
   */
  function usage() {
    store.data.usage = usageOf(store.data.usage, now());
    return store.data.usage;
  }

  const api = createAirlyClient({
    getApiKey: () => config.apiKey,
    onRequest: () => {
      usage().count += 1;
    },
    onUsage: ({ limit, remaining }) => {
      const today = usage();
      if (limit !== null) {
        today.limit = limit;
      }
      if (remaining !== null) {
        today.remaining = remaining;
      }
    },
    ...(fetchFn ? { fetch: fetchFn } : {}),
    ...(baseUrl ? { baseUrl } : {}),
  });

  /**
   * @description Remember the language of a request, and store it when it changed.
   * @param {string} next - The language.
   */
  function rememberLanguage(next) {
    if (typeof next !== 'string' || !/^[a-z]{2}$/.test(next) || next === language) {
      return;
    }
    language = next;
    gladys
      .setConfig({ [INTERNAL_KEYS.language]: next })
      .catch((err) => logger.warn(`Unable to store the language: ${err.message}`));
  }

  /**
   * @description Language of the texts Gladys does not ask for in a language.
   * @returns {string} The language.
   */
  const textLanguage = () => (config.language === AUTO_LANGUAGE ? language : config.language);

  /**
   * @description What is kept of a place.
   * @param {object} place - The place.
   * @returns {object} `{ reading, at, tried, error, installation, instAt, features }`.
   */
  function stateOf(place) {
    store.data.places[place.key] ??= {};
    return store.data.places[place.key];
  }

  /**
   * @description Whether the daily limit was hit (a 429): nothing until midnight UTC.
   * @returns {boolean} True while paused.
   */
  const paused = () => Boolean(usage().pausedUntil && now() < usage().pausedUntil);

  /**
   * @description The message of an error, for a user.
   * @param {Error} err - The error.
   * @param {string} lang - The language.
   * @param {object} [place] - The place concerned.
   * @returns {string} The message.
   */
  function errorText(err, lang, place) {
    const key = {
      auth: 'errAuth',
      no_data: 'errNoData',
      not_found: 'errNotFound',
      rate_limit: 'errRateLimit',
      unreachable: 'errUnreachable',
      no_key: 'errNoKey',
      invalid_installation: 'errInvalidInstallation',
      unknown_house: 'errUnknownHouse',
      house_no_location: 'errHouseNoLocation',
    }[err?.kind];
    return t(key ?? 'errFailed', lang, {
      place: place?.name ?? '',
      value: err?.value ?? '',
      slot: err?.slot ?? '',
      detail: String(err?.message ?? '').slice(0, 120),
    });
  }

  /**
   * @description Report the connection status, only when it changed.
   * @param {boolean} connected - Connected or not.
   * @param {object} message - The multi-language message.
   * @returns {Promise<void>}
   */
  async function reportStatus(connected, message) {
    const clipped = Object.fromEntries(
      Object.entries(message).map(([lang, text]) => [lang, text.trim().slice(0, 200)]),
    );
    const signature = JSON.stringify([connected, clipped]);
    if (signature === lastStatus) {
      return;
    }
    lastStatus = signature;
    try {
      await gladys.setConnectionStatus(connected, clipped);
    } catch (err) {
      lastStatus = null;
      logger.error('Unable to report the connection status', err);
    }
  }

  /**
   * @description The line of a place in a status: "Home CAQI 44 (Good)".
   * @param {object} place - The place.
   * @param {string} lang - The language.
   * @returns {string} The line.
   */
  function placeLine(place, lang) {
    const last = stateOf(place).reading;
    return Number.isFinite(last?.caqi)
      ? t('placeLine', lang, {
          name: place.name,
          caqi: last.caqi,
          level: levelText(last.level, lang),
        })
      : place.name;
  }

  /**
   * @description Work out the connection status from the last readings.
   * @returns {Promise<void>}
   */
  async function refreshStatus() {
    if (!config.apiKey) {
      await reportStatus(false, all('errNoKey'));
      return;
    }
    if (authError) {
      await reportStatus(false, all('errAuth'));
      return;
    }
    if (paused()) {
      await reportStatus(true, all('statusPaused'));
      return;
    }
    if (places.length === 0 && placeErrors.length === 0) {
      await reportStatus(true, all('statusNoPlace'));
      return;
    }
    const failing = [
      ...placeErrors.map(({ err }) => ({ err })),
      ...places
        .filter((place) => stateOf(place).error)
        .map((place) => ({ err: stateOf(place).error, place })),
    ];
    const total = places.length + placeErrors.length;
    if (failing.length > 0) {
      const ok = total - failing.length;
      await reportStatus(
        ok > 0,
        all('statusSomeFailing', (lang) => ({
          ok,
          total,
          detail: errorText(failing[0].err, lang, failing[0].place),
        })),
      );
      return;
    }
    const today = usage();
    await reportStatus(
      true,
      all('statusConnected', (lang) => ({
        places: places.map((place) => placeLine(place, lang)).join(', '),
        usage: t('statusUsage', lang, { count: today.count, limit: limitOf(today) }),
      })),
    );
  }

  /**
   * @description Refresh the list of the devices the user created.
   * @returns {Promise<void>}
   */
  async function refreshCreatedDevices() {
    try {
      const devices = await gladys.getDevices();
      createdDevices = new Set(devices.map((device) => device.external_id));
    } catch (err) {
      logger.warn(`Unable to read the devices: ${err.message}`);
    }
  }

  /**
   * @description Ask the open widgets to pull their content again.
   */
  function refreshWidgets() {
    for (const key of Object.values(WIDGETS)) {
      Promise.resolve(gladys.requestWidgetRefresh(key)).catch(() => {});
    }
  }

  /**
   * @description Publish scene events, one by one.
   * @param {Array<{ key: string, data: object }>} events - The events.
   * @returns {Promise<void>}
   */
  async function publishEvents(events) {
    for (const { key, data } of events) {
      logger.info(`Airly ${data.name}: ${key} (${data.level ?? data.pollutant})`);
      try {
        await gladys.publishSceneEvent(key, data);
      } catch (err) {
        logger.warn(`Unable to fire ${key}: ${err.message}`);
      }
    }
  }

  // --- Places ------------------------------------------------------------------------

  /**
   * @description Resolve the configured places: a sensor, or the location of a house.
   * @returns {Promise<void>}
   */
  async function resolvePlaces() {
    const resolved = [];
    const errors = [];
    let houses = null;
    for (const entry of config.places) {
      try {
        if (entry.invalidInstallation) {
          throw Object.assign(new Error('Invalid installation id'), {
            kind: 'invalid_installation',
            value: entry.invalidInstallation,
          });
        }
        const key = placeKey(entry);
        if (resolved.some((place) => place.key === key)) {
          continue;
        }
        const place = {
          slot: entry.slot,
          key,
          installationId: entry.installationId,
          house: entry.house,
          mode: config.houseMode,
        };
        if (entry.installationId) {
          place.where = { installationId: entry.installationId };
          place.name =
            stateOf(place).installation?.name || `#${entry.installationId}`;
        } else {
          houses ??= await gladys.getHouses().catch((err) => {
            logger.warn(`Unable to read the houses: ${err.message}`);
            return [];
          });
          const house = houses.find((candidate) => candidate.selector === entry.house);
          if (!house) {
            throw Object.assign(new Error('Unknown house'), {
              kind: 'unknown_house',
              slot: entry.slot,
            });
          }
          if (!Number.isFinite(house.latitude) || !Number.isFinite(house.longitude)) {
            throw Object.assign(new Error('House without location'), {
              kind: 'house_no_location',
              slot: entry.slot,
            });
          }
          place.where = {
            latitude: house.latitude,
            longitude: house.longitude,
            mode: config.houseMode,
          };
          place.name = house.name || entry.house;
        }
        place.deviceId = idsOf(gladys, key).device;
        resolved.push(place);
      } catch (err) {
        logger.warn(`Airly place ${entry.slot}: ${err.message}`);
        errors.push({ slot: entry.slot, err });
      }
    }
    places = resolved;
    placeErrors = errors;
  }

  /**
   * @description Offer a device per place on the Discovery screen, when they changed.
   * @param {boolean} [force] - Publish even when unchanged.
   * @returns {Promise<number>} How many devices were offered.
   */
  async function publishDiscoveredDevices(force = false) {
    const lang = textLanguage();
    const devices = places.map((place) =>
      buildPlaceDevice(gladys, { ...place, features: stateOf(place).features }, lang),
    );
    const signature = JSON.stringify(devices);
    if (force || signature !== lastDiscovery) {
      await gladys.publishDiscoveredDevices(devices);
      lastDiscovery = signature;
    }
    return devices.length;
  }

  /**
   * @description The highest CAQI expected for a place.
   * @param {object} place - The place.
   * @returns {object|null} The peak.
   */
  const peakOf = (place) => forecastPeak(stateOf(place).reading ?? null, now());

  /**
   * @description Publish the states of a place, when its device exists.
   * @param {object} place - The place.
   * @returns {Promise<void>}
   */
  async function publishStates(place) {
    if (!createdDevices.has(place.deviceId)) {
      return;
    }
    const states = buildPlaceStates(
      gladys,
      { key: place.key, features: stateOf(place).features },
      stateOf(place).reading ?? null,
      peakOf(place),
      { language: textLanguage(), timeZone },
    );
    if (states.length) {
      await gladys
        .publishChangedStates(states)
        .catch((err) =>
          logger.warn(`Unable to publish the states of ${place.name}: ${err.message}`),
        );
    }
  }

  // --- Reading -----------------------------------------------------------------------

  /**
   * @description Read one place: the address of its sensor once a week, its measurements.
   * @param {object} place - The place.
   * @returns {Promise<void>}
   * @throws {AirlyError} When the measurements could not be read.
   */
  async function readPlace(place) {
    const state = stateOf(place);
    state.tried = now();
    try {
      if (place.installationId && (!state.instAt || now() - state.instAt > INSTALLATION_EVERY_MS)) {
        try {
          state.installation = parseInstallation(await api.installation(place.installationId));
          state.instAt = now();
          place.name = state.installation.name || place.name;
        } catch (err) {
          // The name is a comfort: only a refused key or limit stops here.
          if (['auth', 'rate_limit'].includes(err.kind)) {
            throw err;
          }
          logger.warn(`Airly sensor ${place.installationId}: ${err.message}`);
        }
      }
      const parsed = parseMeasurements(await api.measurements(place.where));
      state.reading = parsed;
      state.at = now();
      state.error = null;
      const optional = new Set([...(state.features ?? []), ...optionalKeysOf(parsed)]);
      state.features = [...optional].sort();
      authError = null;
    } catch (err) {
      const error = err instanceof AirlyError ? err : new AirlyError('failed', String(err?.message));
      logger.warn(`Airly ${place.name} (${error.kind}): ${error.message}`);
      state.error = { kind: error.kind, message: error.message };
      if (error.kind === 'no_data') {
        // A valid answer: nothing to measure there. Read again at the next round.
        state.at = now();
        state.reading = null;
      }
      if (error.kind === 'auth') {
        authError = state.error;
      }
      if (error.kind === 'rate_limit') {
        usage().pausedUntil = now() + msToUtcMidnight(now());
      }
      throw error;
    }
  }

  /**
   * @description What follows the reading of a place: events, states.
   * @param {object} place - The place.
   * @returns {Promise<void>}
   */
  async function digest(place) {
    const state = stateOf(place);
    const last = state.reading;
    const seen = store.data.seen;
    const lang = textLanguage();
    const events = [];
    if (last && gladys.connected !== false) {
      const change = detectLevelChange(seen.level[place.key], last.level);
      if (change) {
        events.push({
          key: TRIGGERS.AIR_QUALITY_CHANGED,
          data: changedData(place, last, change, lang),
        });
      }
      const first = seen.level[place.key] === undefined;
      if (last.level) {
        seen.level[place.key] = last.level;
      }
      const peak = peakOf(place);
      const alert = detectForecastAlert(first ? undefined : (seen.forecast[place.key] ?? null), peak);
      seen.forecast[place.key] = alert.next;
      if (alert.fire) {
        events.push({
          key: TRIGGERS.POLLUTION_EXPECTED,
          data: expectedData(place, last, peak, { language: lang, timeZone, now: now() }),
        });
      }
      const who = detectWhoExceeded(first ? undefined : (seen.who[place.key] ?? []), last.who);
      seen.who[place.key] = who.next;
      events.push(
        ...who.newly.map((pollutant) => ({
          key: TRIGGERS.WHO_LIMIT_EXCEEDED,
          data: whoData(place, last, pollutant, lang),
        })),
      );
    }
    await store.save();
    await publishEvents(events);
    await publishStates(place);
  }

  /**
   * @description Whether the automatic round is due.
   * @returns {boolean} True when a place is older than the planned interval.
   */
  function roundDue() {
    const interval = planInterval({ usage: usage(), places: places.length, now: now() });
    if (interval === null) {
      return false;
    }
    return places.some((place) => {
      const state = stateOf(place);
      if (state.tried && now() - state.tried < Math.min(RETRY_MS, interval)) {
        return false;
      }
      return !state.at || now() - state.at >= interval;
    });
  }

  /**
   * @description Read every place (one round at a time).
   * @param {object} [options] - `{ user }`: asked by the user (Read now, a
   * button, a scene action): read now, on the reserve of the key if need be.
   * @returns {Promise<void>}
   */
  function readPlaces({ user = false } = {}) {
    if (!reading) {
      reading = (async () => {
        if (!config.apiKey || (authError && !user) || places.length === 0) {
          await refreshStatus();
          return;
        }
        if (paused() || !mayRequest(usage(), user) || (!user && !roundDue())) {
          await refreshStatus();
          return;
        }
        let read = false;
        for (const place of places) {
          if (!mayRequest(usage(), user)) {
            break;
          }
          let answered = false;
          try {
            await readPlace(place);
            answered = true;
          } catch (err) {
            answered = err.kind === 'no_data';
            if (['auth', 'rate_limit'].includes(err.kind)) {
              break;
            }
          }
          if (answered) {
            read = true;
            await digest(place);
          }
        }
        await store.save();
        if (read) {
          await publishDiscoveredDevices().catch((err) =>
            logger.warn(`Unable to offer the devices: ${err.message}`),
          );
          refreshWidgets();
        }
        await refreshStatus();
      })().finally(() => {
        reading = null;
      });
    }
    return reading;
  }

  /**
   * @description (Re)arm the reading timer.
   */
  function schedule() {
    clearInterval(timer);
    if (!timers || stopped) {
      return;
    }
    timer = setInterval(() => {
      readPlaces().catch((err) => logger.error('Readings', err));
    }, TICK_MS);
    timer.unref?.();
  }

  /**
   * @description Resolve the places, offer the devices, read what is due.
   * @returns {Promise<void>}
   */
  async function applyConfig() {
    authError = null;
    await resolvePlaces();
    logger.info(
      `${places.length} place(s): ${places.map((place) => place.name).join(', ') || 'none'}` +
        (placeErrors.length ? `; ${placeErrors.length} not resolved` : ''),
    );
    await publishDiscoveredDevices().catch((err) =>
      logger.warn(`Unable to offer the devices: ${err.message}`),
    );
    await readPlaces();
    for (const place of places) {
      await publishStates(place);
    }
    await refreshStatus();
    schedule();
  }

  /**
   * @description The place a widget or a scene action targets.
   * @param {unknown} externalId - The `source: "devices"` value.
   * @returns {object|null} The place, the first one by default.
   */
  function target(externalId) {
    const key = keyOfExternalId(externalId);
    return places.find((place) => place.key === key) ?? places[0] ?? null;
  }

  /**
   * @description Make sure a place has a reading of less than an hour, when the key allows.
   * @param {object} place - The place.
   * @returns {Promise<void>}
   */
  async function ensureFresh(place) {
    const state = stateOf(place);
    if (!state.at || now() - state.at > FRESH_MS) {
      await readPlaces({ user: true });
    }
  }

  // --- Dashboard widgets -------------------------------------------------------------

  /**
   * @description The common start of a widget: configured, a place.
   * @param {object} settings - The widget settings.
   * @param {string} lang - The language.
   * @returns {Promise<{ place?: object, content?: object }>} The place, or the content to show.
   */
  async function widgetPlace(settings, lang) {
    if (!config.apiKey) {
      return { content: messageContent(t('errNoKey', lang)) };
    }
    if (authError) {
      return { content: messageContent(t('errAuth', lang)) };
    }
    const place = target(settings.place);
    if (!place) {
      return { content: messageContent(t('noPlaceWidget', lang)) };
    }
    // A widget never spends the key: it shows what the timer read.
    const state = stateOf(place);
    if (state.error && !state.reading) {
      return {
        content: messageContent(errorText(state.error, lang, place), {
          ttl: TTL_SECONDS.message,
          refresh: true,
        }),
      };
    }
    return { place };
  }

  gladys.onWidgetGet(WIDGETS.AIR_QUALITY, async ({ settings = {}, language: lang }) => {
    rememberLanguage(lang);
    const { place, content } = await widgetPlace(settings, lang);
    if (content) {
      return content;
    }
    return buildAirQualityWidget({
      place,
      reading: stateOf(place).reading ?? null,
      language: lang,
      timeZone,
    });
  });

  gladys.onWidgetGet(WIDGETS.FORECAST, async ({ settings = {}, language: lang }) => {
    rememberLanguage(lang);
    const { place, content } = await widgetPlace(settings, lang);
    if (content) {
      return content;
    }
    return buildForecastWidget({
      place,
      reading: stateOf(place).reading ?? null,
      peak: peakOf(place),
      language: lang,
      timeZone,
      now: now(),
    });
  });

  /**
   * @description The Refresh button of both widgets: read again when the last
   * reading is not recent (the key has a daily limit).
   * @param {string} actionKey - The action.
   * @param {object} settings - The widget settings.
   * @returns {Promise<object>} The toast.
   */
  async function refreshAction(actionKey, settings) {
    if (actionKey !== WIDGET_ACTIONS.REFRESH) {
      throw new Error(`Unknown action ${actionKey}`);
    }
    const place = target(settings?.place);
    if (!place) {
      return all('noPlaceWidget');
    }
    const state = stateOf(place);
    if (state.at && !state.error && now() - state.at < REFRESH_MIN_AGE_MS) {
      return all('refreshCached');
    }
    if (paused() || !mayRequest(usage(), true)) {
      return all('errRateLimit');
    }
    await readPlaces({ user: true });
    if (stateOf(place).error) {
      return Object.fromEntries(
        LANGUAGES.map((lang) => [lang, errorText(stateOf(place).error, lang, place).slice(0, 200)]),
      );
    }
    return all('refreshDone', { caqi: stateOf(place).reading?.caqi ?? '–' });
  }

  gladys.onWidgetAction(WIDGETS.AIR_QUALITY, async (actionKey, params, { settings } = {}) =>
    refreshAction(actionKey, settings),
  );
  gladys.onWidgetAction(WIDGETS.FORECAST, async (actionKey, params, { settings } = {}) =>
    refreshAction(actionKey, settings),
  );

  // --- Scene action ------------------------------------------------------------------
  gladys.onSceneAction(SCENE_ACTIONS.GET_AIR_QUALITY, async (fields = {}) => {
    if (!config.apiKey) {
      throw new Error('The Airly API key is not configured');
    }
    const place = target(fields.place);
    if (!place) {
      throw new Error('No Airly place is configured');
    }
    await ensureFresh(place);
    const state = stateOf(place);
    const last = state.reading;
    if (!last) {
      throw new Error(`Airly could not be read: ${state.error?.message ?? 'no reading yet'}`);
    }
    const lang = textLanguage();
    const peak = peakOf(place);
    const time = peak ? formatTime(peak.at, { language: lang, timeZone }) : null;
    const summary = [
      Number.isFinite(last.caqi)
        ? t('summaryNow', lang, {
            name: place.name,
            level: levelText(last.level, lang),
            caqi: last.caqi,
            pm25: Number.isFinite(last.values.pm25)
              ? new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(last.values.pm25)
              : '–',
          })
        : t('summaryNoNow', lang, { name: place.name }),
      peak
        ? t('summaryForecast', lang, {
            level: levelText(peak.level, lang).toLocaleLowerCase(lang),
            caqi: peak.caqi,
            time,
          })
        : '',
    ]
      .filter(Boolean)
      .join(' ');
    return pick(
      {
        name: place.name,
        caqi: last.caqi,
        level: last.level,
        level_name: levelText(last.level, lang),
        ...last.values,
        pm25_who_percent: last.who.pm25?.percent,
        pm10_who_percent: last.who.pm10?.percent,
        forecast_caqi: peak?.caqi,
        forecast_level: peak?.level,
        forecast_time: time,
        summary,
      },
      AIR_QUALITY_OUTPUTS,
    );
  });

  // --- Configuration screen actions --------------------------------------------------
  gladys.onAction(ACTIONS.READ_NOW, async () => {
    if (!config.apiKey) {
      return all('errNoKey');
    }
    authError = null;
    await resolvePlaces();
    await publishDiscoveredDevices().catch(() => {});
    if (paused()) {
      return all('statusPaused');
    }
    await readPlaces({ user: true });
    if (authError) {
      return all('errAuth');
    }
    if (places.length === 0 && placeErrors.length === 0) {
      return all('statusNoPlace');
    }
    return Object.fromEntries(
      LANGUAGES.map((lang) => {
        const lines = [
          ...places.map((place) => {
            const state = stateOf(place);
            if (state.error) {
              return errorText(state.error, lang, place);
            }
            return state.reading
              ? placeLine(place, lang)
              : t('summaryNoNow', lang, { name: place.name });
          }),
          ...placeErrors.map(({ err }) => errorText(err, lang)),
        ];
        return [lang, t('readDone', lang, { places: lines.join(' · ') }).slice(0, 1000)];
      }),
    );
  });

  gladys.onAction(ACTIONS.DIAGNOSTIC, async () => {
    const today = usage();
    const report = {
      version: VERSION,
      timeZone: timeZone ?? null,
      apiKey: config.apiKey ? 'set' : 'missing',
      language: config.language,
      houseMode: config.houseMode,
      usage: {
        day: today.day,
        count: today.count,
        limit: limitOf(today),
        remaining: remainingOf(today),
        paused: paused(),
      },
      intervalMinutes: (() => {
        const interval = planInterval({ usage: today, places: places.length, now: now() });
        return interval === null ? null : interval / MINUTE_MS;
      })(),
      authError: authError?.message ?? null,
      places: places.map((place) => {
        const state = stateOf(place);
        return {
          slot: place.slot,
          key: place.key,
          // The coordinates of a house never go to the logs.
          where: place.installationId
            ? { installation: place.installationId }
            : { house: place.house, mode: place.mode },
          created: createdDevices.has(place.deviceId),
          measuredAt: state.reading?.at ? new Date(state.reading.at).toISOString() : null,
          caqi: state.reading?.caqi ?? null,
          values: state.reading ? Object.keys(state.reading.values) : null,
          forecastHours: state.reading?.forecast.length ?? null,
          features: state.features ?? [],
          readAt: state.at ? new Date(state.at).toISOString() : null,
          error: state.error ? `${state.error.kind}: ${state.error.message}` : null,
        };
      }),
      placeErrors: placeErrors.map(({ slot, err }) => `${slot}: ${err.kind}`),
    };
    const json = JSON.stringify(report);
    const count = Math.max(1, Math.ceil(json.length / DIAGNOSTIC_CHUNK));
    for (let chunk = 0; chunk < count; chunk += 1) {
      logger.info(
        `Airly diagnostic ${chunk + 1}/${count}: ${json.slice(chunk * DIAGNOSTIC_CHUNK, (chunk + 1) * DIAGNOSTIC_CHUNK)}`,
      );
    }
    return all('diagnosticDone', { count });
  });

  // --- Devices -----------------------------------------------------------------------
  gladys.onScanRequest(async () => {
    await resolvePlaces();
    const count = await publishDiscoveredDevices(true);
    logger.info(`Scan: ${count} device(s) offered`);
  });

  gladys.onDeviceCreated(async () => {
    await refreshCreatedDevices();
    // States sent before the device existed were dropped by Gladys, and the SDK
    // forgot what it sent for this device: send everything known again.
    for (const place of places) {
      await publishStates(place);
    }
    refreshWidgets();
  });

  gladys.onDeviceDeleted(refreshCreatedDevices);

  // --- Configuration -----------------------------------------------------------------

  /**
   * @description Reload the whole config (internal keys included).
   * @param {object} [fallback] - Raw values to use when the read fails.
   * @returns {Promise<void>}
   */
  async function loadConfig(fallback) {
    try {
      const raw = await gladys.getConfig();
      config = normalizeConfig(raw);
      language = readLanguage(raw, language);
    } catch (err) {
      if (fallback) {
        config = normalizeConfig(fallback);
      }
      logger.error('Unable to read the configuration', err);
    }
  }

  gladys.onConfigUpdated(async (rawConfig) => {
    const previous = { key: config.apiKey, mode: config.houseMode };
    await loadConfig(rawConfig);
    logger.info('Configuration updated');
    lastStatus = null;
    lastDiscovery = null;
    if (config.apiKey !== previous.key || config.houseMode !== previous.mode) {
      // A new key or a new mode: read again at once (a new key also lifts the pause).
      for (const state of Object.values(store.data.places)) {
        state.at = 0;
        state.tried = 0;
      }
      if (config.apiKey !== previous.key) {
        store.data.usage = null;
      }
    }
    await applyConfig();
  });

  // --- Connection lifecycle ----------------------------------------------------------
  // Each (re)connection resynchronizes; the promise lets the tests wait for it.
  let startup = Promise.resolve();
  gladys.on('connected', () => {
    startup = (async () => {
      await loadConfig();
      await store.load();
      await refreshCreatedDevices();
      lastStatus = null;
      lastDiscovery = null;
      await applyConfig();
    })().catch((err) => logger.error('Startup', err));
  });

  // --- Graceful shutdown -------------------------------------------------------------
  gladys.handleShutdown(async (signal) => {
    logger.info(`Received ${signal} -> graceful shutdown`);
    stopped = true;
    clearInterval(timer);
    await store.save();
  });

  return {
    store,
    api,
    readPlaces,
    applyConfig,
    getPlaces: () => places,
    getPlaceErrors: () => placeErrors,
    whenReady: () => startup,
  };
}

export { createApp, ACTIONS, SCENE_ACTIONS, TICK_MS, RETRY_MS, FRESH_MS, REFRESH_MIN_AGE_MS };
