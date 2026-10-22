// -----------------------------------------------------------------------------
// Dashboard widgets of the Airly integration.
//
//   - `air_quality`  the air now: the CAQI in the color of its level, PM1,
//                    PM2.5 and PM10 (colored by the WHO guideline values),
//                    the temperature, the advice of the level, humidity and
//                    pressure, the hour of the measurement;
//   - `forecast`     the CAQI of the last 24 hours and of the next 24 hours
//                    on one chart, the value now and the highest one
//                    expected, a warning when it reaches a high level.
// Both credit Airly and show the hour of the data. A place is chosen among
// the devices; the first one by default.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { t, all, levelText } from './i18n.js';
import { ALERT_LEVELS } from './caqi.js';
import { formatTime } from './time.js';

const WIDGETS = { AIR_QUALITY: 'air_quality', FORECAST: 'forecast' };
const WIDGET_ACTIONS = { REFRESH: 'refresh' };
const TTL_SECONDS = { content: 600, message: 300 };
const COLORS = {
  very_low: WIDGET_COLORS.SUCCESS,
  low: WIDGET_COLORS.SUCCESS,
  medium: WIDGET_COLORS.WARNING,
  high: WIDGET_COLORS.DANGER,
  very_high: WIDGET_COLORS.DANGER,
};
const UNIT = 'µg/m³';
// The tiles of the air quality widget, after the CAQI: five at most.
const TILES = [
  { key: 'pm1', label: 'PM1', unit: UNIT },
  { key: 'pm25', label: 'PM2.5', unit: UNIT, who: true },
  { key: 'pm10', label: 'PM10', unit: UNIT, who: true },
  { key: 'temperature', label: 'tileTemperature', unit: '°C', translated: true },
];

/**
 * @description Truncate a text to a bound, with an ellipsis.
 * @param {string} value - The text.
 * @param {number} max - The bound.
 * @returns {string} The text.
 */
function clip(value, max) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * @description The color of a level.
 * @param {string|null} level - The level key.
 * @returns {string} A widget color.
 */
const colorOf = (level) => COLORS[level] ?? WIDGET_COLORS.NEUTRAL;

/**
 * @description The color of a pollutant against its WHO guideline value.
 * @param {number|undefined} percent - The value, in % of the guideline.
 * @returns {string|undefined} A widget color, none without a guideline.
 */
function whoColor(percent) {
  if (!Number.isFinite(percent)) {
    return undefined;
  }
  if (percent <= 100) {
    return WIDGET_COLORS.SUCCESS;
  }
  return percent <= 200 ? WIDGET_COLORS.WARNING : WIDGET_COLORS.DANGER;
}

/**
 * @description A decimal written the way of a language: "4,4" in French.
 * @param {number} value - The value.
 * @param {string} language - The language.
 * @returns {string} The text.
 */
const decimal = (value, language) =>
  new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(value);

/**
 * @description The Refresh button.
 * @returns {object} The button.
 */
const refreshButton = () => ({
  type: 'button',
  label: all('buttonRefresh'),
  icon: 'refresh-cw',
  action: { key: WIDGET_ACTIONS.REFRESH },
});

/**
 * @description A widget content made of one message.
 * @param {string} message - The message.
 * @param {object} [options] - `{ ttl, refresh }`.
 * @returns {object} The content.
 */
function messageContent(message, { ttl = TTL_SECONDS.message, refresh = false } = {}) {
  const components = [{ type: 'text', variant: 'body', text: clip(message, 300) }];
  if (refresh) {
    components.push(refreshButton());
  }
  return { ttl_seconds: ttl, components };
}

/**
 * @description The caption of a widget: place, hour, source.
 * @param {object} place - `{ name }`.
 * @param {object} reading - The reading.
 * @param {object} options - `{ language, timeZone }`.
 * @returns {object} The text component.
 */
function caption(place, reading, { language, timeZone }) {
  // The source and the hour always show: a long place name gives way.
  const tail = ` · ${t('measuredAt', language, {
    time: formatTime(reading.at, { language, timeZone }),
  })} · Airly`;
  return {
    type: 'text',
    variant: 'caption',
    text: `${clip(place.name, 80 - tail.length)}${tail}`,
  };
}

/**
 * @description The "air_quality" widget.
 * @param {object} options - Options.
 * @param {object} options.place - `{ name }`.
 * @param {object|null} options.reading - The reading.
 * @param {string} options.language - The user language.
 * @param {string} [options.timeZone] - IANA timezone.
 * @returns {object} The content.
 */
function buildAirQualityWidget({ place, reading, language, timeZone }) {
  if (!reading) {
    return {
      ttl_seconds: TTL_SECONDS.message,
      components: [
        { type: 'text', variant: 'heading', text: clip(place.name, 40) },
        { type: 'text', variant: 'body', text: clip(t('noReading', language), 300) },
        refreshButton(),
      ],
    };
  }
  const components = [caption(place, reading, { language, timeZone })];
  if (Number.isFinite(reading.caqi)) {
    components.push({
      type: 'value',
      value: reading.caqi,
      label: clip(`CAQI · ${levelText(reading.level, language, true)}`, 24),
      icon: 'wind',
      color: colorOf(reading.level),
    });
  }
  for (const tile of TILES) {
    const value = reading.values[tile.key];
    if (!Number.isFinite(value)) {
      continue;
    }
    const component = {
      type: 'value',
      value: decimal(value, language),
      unit: tile.unit,
      label: tile.translated ? t(tile.label, language) : tile.label,
    };
    const color = tile.who ? whoColor(reading.who[tile.key]?.percent) : undefined;
    if (color) {
      component.color = color;
    }
    components.push(component);
  }
  const weather = [
    Number.isFinite(reading.values.humidity)
      ? t('humidityText', language, { value: Math.round(reading.values.humidity) })
      : '',
    Number.isFinite(reading.values.pressure)
      ? t('pressureText', language, { value: Math.round(reading.values.pressure) })
      : '',
  ]
    .filter(Boolean)
    .join(' · ');
  components.push({
    type: 'text',
    variant: 'body',
    text: clip(
      [
        reading.level
          ? `${levelText(reading.level, language)}. ${t(`advice_${reading.level}`, language)}`
          : '',
        weather,
      ]
        .filter(Boolean)
        .join('\n'),
      300,
    ),
  });
  components.push(refreshButton());
  return { ttl_seconds: TTL_SECONDS.content, components };
}

/**
 * @description The "forecast" widget.
 * @param {object} options - Options.
 * @param {object} options.place - `{ name }`.
 * @param {object|null} options.reading - The reading.
 * @param {object|null} options.peak - The highest CAQI expected.
 * @param {string} options.language - The user language.
 * @param {string} [options.timeZone] - IANA timezone.
 * @param {number} options.now - Now (ms).
 * @returns {object} The content.
 */
function buildForecastWidget({ place, reading, peak, language, timeZone, now }) {
  const future = (reading?.forecast ?? []).filter((point) => point.at > now);
  if (!reading || future.length === 0) {
    return {
      ttl_seconds: TTL_SECONDS.content,
      components: [
        { type: 'text', variant: 'heading', text: clip(place.name, 40) },
        { type: 'text', variant: 'body', text: clip(t('noForecast', language), 300) },
        refreshButton(),
      ],
    };
  }
  const point = ({ at, caqi }) => ({ t: new Date(at).toISOString(), v: caqi });
  const measured = [...reading.history, ...(Number.isFinite(reading.caqi) ? [reading] : [])]
    .filter((entry) => Number.isFinite(entry.at) && Number.isFinite(entry.caqi))
    .map(point);
  // The forecast line starts where the measured one ends.
  const expected = [...measured.slice(-1), ...future.map(point)];
  const series = [];
  if (measured.length) {
    series.push({ name: clip(t('seriesMeasured', language), 24), points: measured });
  }
  series.push({ name: clip(t('seriesForecast', language), 24), points: expected });
  const rows = [];
  if (Number.isFinite(reading.caqi)) {
    rows.push({
      label: t('rowNow', language),
      value: clip(`${reading.caqi} · ${levelText(reading.level, language, true)}`, 40),
      color: colorOf(reading.level),
    });
  }
  if (peak) {
    rows.push({
      label: t('rowPeak', language),
      value: clip(
        `${peak.caqi} · ${levelText(peak.level, language, true)} · ${formatTime(peak.at, { language, timeZone })}`,
        40,
      ),
      color: colorOf(peak.level),
    });
  }
  const components = [
    caption(place, reading, { language, timeZone }),
    { type: 'chart', chart_type: 'area', unit: 'CAQI', series, now_marker: true },
  ];
  if (rows.length) {
    components.push({ type: 'status', items: rows });
  }
  if (peak && ALERT_LEVELS.includes(peak.level)) {
    components.push({
      type: 'text',
      variant: 'body',
      text: clip(
        `${t('alertBody', language, {
          level: levelText(peak.level, language).toLocaleLowerCase(language),
          time: formatTime(peak.at, { language, timeZone }),
        })} ${t(`advice_${peak.level}`, language)}`,
        300,
      ),
    });
  }
  components.push(refreshButton());
  return { ttl_seconds: TTL_SECONDS.content, components };
}

export {
  WIDGETS,
  WIDGET_ACTIONS,
  TTL_SECONDS,
  COLORS,
  clip,
  colorOf,
  whoColor,
  messageContent,
  buildAirQualityWidget,
  buildForecastWidget,
};
