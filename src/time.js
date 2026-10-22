// -----------------------------------------------------------------------------
// Times.
//
// Airly gives UTC instants and counts the daily limit of a key per UTC day.
// Texts are written in the timezone of the Gladys instance (TZ, given by the
// supervisor).
// -----------------------------------------------------------------------------

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * @description The timezone of the instance.
 * @returns {string|undefined} An IANA name, undefined for the system one.
 */
function defaultTimeZone() {
  return process.env.TZ || undefined;
}

/**
 * @description The UTC day of an instant.
 * @param {number} instant - The instant (ms).
 * @returns {string} "YYYY-MM-DD".
 */
const utcDay = (instant) => new Date(instant).toISOString().slice(0, 10);

/**
 * @description The time left until the next midnight UTC.
 * @param {number} instant - The instant (ms).
 * @returns {number} Milliseconds (never 0).
 */
const msToUtcMidnight = (instant) => DAY_MS - (instant % DAY_MS);

/**
 * @description "18:00" in the language and timezone of the user.
 * @param {number|null} instant - The instant (ms).
 * @param {object} [options] - `{ language, timeZone }`.
 * @returns {string} The time, '' when none.
 */
function formatTime(instant, { language = 'en', timeZone = defaultTimeZone() } = {}) {
  if (!Number.isFinite(instant)) {
    return '';
  }
  return new Intl.DateTimeFormat(language, {
    timeZone,
    hour: language === 'en' ? 'numeric' : '2-digit',
    minute: '2-digit',
    hourCycle: language === 'en' ? 'h12' : 'h23',
  }).format(new Date(instant));
}

/**
 * @description Whole hours from one instant to another, rounded up.
 * @param {number} from - The instant (ms).
 * @param {number} to - The later instant (ms).
 * @returns {number} Hours, at least 0.
 */
const hoursBetween = (from, to) => Math.max(0, Math.ceil((to - from) / HOUR_MS));

export {
  MINUTE_MS,
  HOUR_MS,
  DAY_MS,
  defaultTimeZone,
  utcDay,
  msToUtcMidnight,
  formatTime,
  hoursBetween,
};
