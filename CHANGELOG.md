# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/). This file is generated at
each release from the Conventional Commits: do not edit it by hand.

## [0.2.0] - 2026-10-25

### Added

- require Gladys 5.3 and declare catalog keywords ([decc374](https://github.com/William-De71/gladys-airly/commit/decc37418d2fb4ec3aad10db058aff10a97317c1))

## [0.1.1] - 2026-10-24

### Security

- **security:** build the image on Node.js 24.22.1 or later ([760edd9](https://github.com/William-De71/gladys-airly/commit/760edd9be94e7d44f678fbf5cc7aad6de3d835d0))

## [0.1.0] - 2026-10-22

### Added

- Air quality of Airly for up to three places, each a house of Gladys (interpolated at its location, or its nearest sensor) or an Airly sensor, through the Airly API v2 (a free key per user).
- One device per place: the CAQI and its level, PM2.5, PM10, the highest CAQI expected within 24 hours and its text, and, when the place gives them, the temperature, humidity, pressure, NO₂, O₃ and SO₂.
- Scene triggers: air quality changed (filters: place, new level, worse or better), pollution expected within 24 hours (poor or very poor), WHO guideline value exceeded (PM2.5, PM10, NO₂, ozone).
- Scene action: read the air quality of a place, with a ready-made sentence.
- Dashboard widgets: the air quality now (CAQI, PM1, PM2.5, PM10, temperature, advice) and a chart of the CAQI over the last and the next 24 hours.
- Configuration actions: read now and a diagnostic written to the logs without the key nor the coordinates.
- Cloud transport: every place read in one round, as often as the daily limit of the key allows (every 30 to 50 minutes with a free key), a reserve kept for the user, readings kept in /data.
- English, French, German and Spanish everywhere: settings, devices, widgets, scenes and documentation.

[0.2.0]: https://github.com/William-De71/gladys-airly/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/William-De71/gladys-airly/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/William-De71/gladys-airly/releases/tag/v0.1.0
