// -----------------------------------------------------------------------------
// HTTP client of the Airly API v2 (https://airapi.airly.eu, Swagger served at
// https://airapi.airly.eu/docs/v2).
//
//   GET /v2/measurements/installation?installationId=…   a sensor
//   GET /v2/measurements/point?lat=…&lng=…                interpolated at a point
//   GET /v2/measurements/nearest?lat=…&lng=…&maxDistanceKM=…
//   GET /v2/installations/{id}                            address of a sensor
// Each measurements answer holds `current`, `history` (24 h) and `forecast`
// (24 h), hour by hour: one request gives everything a place needs.
//
// The key goes in the `apikey` header (never in a URL, never logged). Texts
// are asked in English (`Accept-Language: en`, Airly only speaks English and
// Polish): the integration writes its own texts in four languages.
//
// Errors: 401 for a refused key, 404 for an unknown installation (or nothing
// within the distance of `nearest`), 429 past the daily limit of the key, 301
// for an installation replaced by another (fetch follows it). A point with no
// sensor around answers 200 with an index whose value is null ("There are no
// Airly sensors in this area yet."): parse.js tells it apart.
//
// Every answer carries the daily limit of the key and what remains of it
// (`X-RateLimit-Limit-day`, `X-RateLimit-Remaining-day`, reset at midnight
// UTC; 100 requests a day for a free key, 1,000 for the keys made before
// 2020): `onUsage` hands them to the plan of usage.js.
// -----------------------------------------------------------------------------

const BASE_URL = 'https://airapi.airly.eu';
const TIMEOUT_MS = 15000;
const NEAREST_KM = 3;

/**
 * @description An error of the Airly API, with a kind the messages can tell apart.
 */
class AirlyError extends Error {
  /**
   * @param {string} kind - `auth`, `not_found`, `no_data`, `rate_limit`,
   * `unreachable`, `invalid`, `failed`.
   * @param {string} message - The message.
   * @param {number} [status] - The HTTP status.
   */
  constructor(kind, message, status) {
    super(message);
    this.name = 'AirlyError';
    this.kind = kind;
    this.status = status;
  }
}

/**
 * @description The kind of an HTTP status.
 * @param {number} status - The status.
 * @param {string} path - The path asked (a 404 of `nearest` means "nothing near").
 * @returns {string} The kind.
 */
function kindOf(status, path = '') {
  if (status === 401 || status === 403) {
    return 'auth';
  }
  if (status === 429) {
    return 'rate_limit';
  }
  if (status === 404) {
    return path.includes('/nearest') ? 'no_data' : 'not_found';
  }
  if (status >= 400 && status < 500) {
    return 'invalid';
  }
  return 'failed';
}

/**
 * @description A coordinate for a query, 4 decimals (about 10 m).
 * @param {number} value - The coordinate.
 * @returns {string} The text.
 */
const coordinate = (value) => Number(value).toFixed(4);

/**
 * @description The path and query of the measurements of a place.
 * @param {object} where - `{ installationId }`, or `{ latitude, longitude, mode }`
 * with `mode` `point` (interpolated) or `nearest` (the closest sensor).
 * @returns {{ path: string, query: object }} The request.
 */
function measurementsRequest(where) {
  if (where.installationId) {
    return {
      path: '/v2/measurements/installation',
      query: { installationId: String(where.installationId) },
    };
  }
  const point = { lat: coordinate(where.latitude), lng: coordinate(where.longitude) };
  if (where.mode === 'nearest') {
    return {
      path: '/v2/measurements/nearest',
      query: { ...point, maxDistanceKM: String(NEAREST_KM) },
    };
  }
  return { path: '/v2/measurements/point', query: point };
}

/**
 * @description Read a counter header.
 * @param {Headers} headers - The headers.
 * @param {string} name - The header.
 * @returns {number|null} The integer, null when absent.
 */
function headerInt(headers, name) {
  const value = Number.parseInt(headers?.get?.(name) ?? '', 10);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * @description The Airly client.
 * @param {object} options - Options.
 * @param {Function} options.getApiKey - `() => string`.
 * @param {Function} [options.onUsage] - `({ limit, remaining }) => void`, after each answer.
 * @param {Function} [options.onRequest] - `() => void`, before each request (the daily count).
 * @param {Function} [options.fetch] - The fetch implementation (tests).
 * @param {string} [options.baseUrl] - The API root.
 * @returns {object} The client.
 */
function createAirlyClient({
  getApiKey,
  onUsage = () => {},
  onRequest = () => {},
  fetch: fetchFn = globalThis.fetch,
  baseUrl = BASE_URL,
}) {
  /**
   * @description GET a path.
   * @param {string} path - The path.
   * @param {object} [query] - The parameters.
   * @returns {Promise<object>} The JSON answer.
   */
  async function get(path, query = {}) {
    const key = getApiKey();
    if (!key) {
      throw new AirlyError('auth', 'No API key');
    }
    const url = new URL(path, baseUrl);
    for (const [name, value] of Object.entries(query)) {
      url.searchParams.set(name, value);
    }
    onRequest();
    let response;
    try {
      response = await fetchFn(url, {
        headers: { accept: 'application/json', 'accept-language': 'en', apikey: key },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new AirlyError('unreachable', String(err?.cause?.code ?? err?.message ?? err));
    }
    const limit = headerInt(response.headers, 'x-ratelimit-limit-day');
    const remaining = headerInt(response.headers, 'x-ratelimit-remaining-day');
    if (limit !== null || remaining !== null) {
      onUsage({ limit, remaining });
    }
    const body = await response.text();
    if (!response.ok) {
      let message;
      try {
        message = String(JSON.parse(body)?.message ?? '');
      } catch {
        message = body;
      }
      throw new AirlyError(
        kindOf(response.status, path),
        `HTTP ${response.status}${message ? `: ${message.slice(0, 120)}` : ''}`,
        response.status,
      );
    }
    try {
      return JSON.parse(body);
    } catch {
      throw new AirlyError('failed', 'Unreadable answer', response.status);
    }
  }

  return {
    /**
     * @description The measurements of a place.
     * @param {object} where - See measurementsRequest.
     * @returns {Promise<object>} `{ current, history, forecast }`.
     */
    async measurements(where) {
      const { path, query } = measurementsRequest(where);
      const data = await get(path, query);
      if (!data || typeof data !== 'object' || !data.current) {
        throw new AirlyError('failed', 'Unexpected answer');
      }
      return data;
    },
    /**
     * @description An installation (a sensor) and its address.
     * @param {number|string} id - The installation id.
     * @returns {Promise<object>} The installation.
     */
    installation: (id) => get(`/v2/installations/${encodeURIComponent(String(id))}`),
  };
}

export {
  BASE_URL,
  NEAREST_KM,
  AirlyError,
  kindOf,
  measurementsRequest,
  headerInt,
  createAirlyClient,
};
