// -----------------------------------------------------------------------------
// The daily limit of the Airly key, and the reading plan that respects it.
//
// A free key allows 100 requests a day (1,000 for the keys made before 2020),
// counted per UTC day: Airly tells the limit and what remains in the headers
// of each answer, the integration also counts its own requests (the headers
// are sometimes missing). One reading of a place is one request.
//
// The plan: the automatic readings share the limit minus a reserve kept for
// the user (Read now, the Refresh button, a scene action), every place read
// in the same round. A round every `max(30 min, day / rounds the budget
// allows)`, stretched when what remains today would not last until midnight
// UTC; nothing automatic once only the reserve remains.
// -----------------------------------------------------------------------------

import { MINUTE_MS, HOUR_MS, utcDay, msToUtcMidnight } from './time.js';

const DEFAULT_LIMIT = 100;
const RESERVE = 10;
const MIN_INTERVAL_MS = 30 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const STEP_MS = 5 * MINUTE_MS;

/**
 * @description A fresh usage record for a UTC day.
 * @param {string} day - "YYYY-MM-DD".
 * @param {number|null} [limit] - The limit known so far.
 * @returns {object} `{ day, count, limit, remaining }`.
 */
const freshUsage = (day, limit = null) => ({ day, count: 0, limit, remaining: null });

/**
 * @description The usage of today, reset at midnight UTC (the limit known is kept).
 * @param {object|undefined} usage - The stored usage.
 * @param {number} now - Now (ms).
 * @returns {object} The usage of today (the same object when still today).
 */
function usageOf(usage, now) {
  const day = utcDay(now);
  if (!usage || usage.day !== day) {
    return freshUsage(day, Number.isInteger(usage?.limit) ? usage.limit : null);
  }
  return usage;
}

/**
 * @description The limit of the key: the one Airly told, else the free one.
 * @param {object} usage - The usage of today.
 * @returns {number} Requests a day.
 */
const limitOf = (usage) => (Number.isInteger(usage?.limit) && usage.limit > 0 ? usage.limit : DEFAULT_LIMIT);

/**
 * @description What remains today: Airly's count when known, never more than ours.
 * @param {object} usage - The usage of today.
 * @returns {number} Requests left.
 */
function remainingOf(usage) {
  const ours = Math.max(0, limitOf(usage) - (usage?.count ?? 0));
  return Number.isInteger(usage?.remaining) ? Math.min(usage.remaining, ours) : ours;
}

/**
 * @description The interval between two automatic rounds.
 * @param {object} options - Options.
 * @param {object} options.usage - The usage of today.
 * @param {number} options.places - Requests per round (one per place).
 * @param {number} options.now - Now (ms).
 * @returns {number|null} The interval (ms), null when only the reserve remains.
 * @example
 * planInterval({ usage, places: 3, now }); // 100 a day: 90 / 3 = 30 rounds -> 50 min
 */
function planInterval({ usage, places, now }) {
  if (places <= 0) {
    return null;
  }
  const rounds = Math.floor((limitOf(usage) - RESERVE) / places);
  let interval = rounds > 0 ? Math.max(MIN_INTERVAL_MS, DAY_MS / rounds) : DAY_MS;
  const left = Math.floor((remainingOf(usage) - RESERVE) / places);
  if (left <= 0) {
    return null;
  }
  interval = Math.max(interval, msToUtcMidnight(now) / left);
  return Math.ceil(interval / STEP_MS) * STEP_MS;
}

/**
 * @description Whether a request may still be sent today.
 * @param {object} usage - The usage of today.
 * @param {boolean} user - True for a request the user asked (the reserve is theirs).
 * @returns {boolean} True when allowed.
 */
const mayRequest = (usage, user) => remainingOf(usage) > (user ? 0 : RESERVE);

export {
  DEFAULT_LIMIT,
  RESERVE,
  MIN_INTERVAL_MS,
  freshUsage,
  usageOf,
  limitOf,
  remainingOf,
  planInterval,
  mayRequest,
};
