// -----------------------------------------------------------------------------
// The CAQI scale (Common Air Quality Index, CITEAIR project, the European
// index Airly computes by default: AIRLY_CAQI).
//
// Five levels, from the value — never from the text of Airly, whose level
// names and translations are its own (Airly adds EXTREME and AIRMAGEDDON
// above 100): the keys below are the integration's, stored by scenes.
//   very_low 0-25 · low 25-50 · medium 50-75 · high 75-100 · very_high > 100
// A bound belongs to the level above it (25 is "low").
// -----------------------------------------------------------------------------

const LEVEL_KEYS = ['very_low', 'low', 'medium', 'high', 'very_high'];
const BOUNDS = [25, 50, 75, 100];
// The forecast alert: from "high" on.
const ALERT_LEVELS = ['high', 'very_high'];

/**
 * @description The level of a CAQI value.
 * @param {number|null|undefined} value - The CAQI.
 * @returns {string|null} The level key, null without a value.
 * @example
 * levelOf(62); // -> 'medium'
 */
function levelOf(value) {
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }
  const index = BOUNDS.findIndex((bound) => value < bound);
  return LEVEL_KEYS[index === -1 ? LEVEL_KEYS.length - 1 : index];
}

/**
 * @description The rank of a level (0 very low … 4 very high).
 * @param {string|null} level - The level key.
 * @returns {number} The rank, -1 when unknown.
 */
const rankOf = (level) => LEVEL_KEYS.indexOf(level);

export { LEVEL_KEYS, BOUNDS, ALERT_LEVELS, levelOf, rankOf };
