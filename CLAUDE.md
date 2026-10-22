# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** for Airly, a network of air
quality sensors in Poland and across Europe: a Node.js service (Node 22+, ESM,
no build step) that runs in its own sandboxed Docker container and talks to
Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
its only runtime dependency. It reads the Airly API v2
(`https://airapi.airly.eu`, a free key per user, 100 requests a day):
`/v2/measurements/point`, `/v2/measurements/nearest` and
`/v2/measurements/installation` (the hour now, 24 hours back, 24 hours ahead),
and `/v2/installations/{id}` (the address of a sensor), for up to three places
— a house of Gladys or an Airly sensor. Transport: cloud only. Reference: the
Swagger served at `https://airapi.airly.eu/docs/v2`; the developer portal
(developer.airly.org) sits behind a bot challenge.

## Commands

```bash
npm install
npm test                                  # node --test, the built-in runner
node --test test/widgets.test.js          # one file
DEBUG=gladys-integration-sdk npm test     # with the SDK debug logs
UPDATE_BASELINE=1 node --test test/structure.test.js   # ONLY with a documented migration
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store . --skip-image-check   # store checks
scripts/build-cover.sh                    # cover.jpg from docs/assets/cover.svg
docs/illustrations/render.sh              # docs/assets/widgets.<lang>.png
node .github/scripts/release.mjs next     # the version the next release would get
```

## Architecture

```
index.js                SDK wiring only (new GladysIntegration + createApp)
src/app.js              every handler, registered before connect(); the reading timer
src/airly-api.js        HTTP client: the key in the `apikey` header, error kinds, daily limit headers
src/parse.js            measurements -> readings (CAQI, values, WHO, history, forecast), forecast peak
src/caqi.js             the CAQI scale: five levels from the value
src/usage.js            requests of the UTC day, the reading plan, the reserve of the user
src/events.js           scene trigger transitions, payloads, scene action outputs
src/device.js           the place devices, their features (optional ones only grow) and states
src/widgets.js          air quality and forecast dashboard widgets
src/store.js            /data/airly.json: usage, last readings, features, `seen`
src/time.js             UTC days, formats in the timezone of Gladys
src/config.js           configuration (key, three places: house or sensor, house mode, language)
src/i18n.js             runtime texts, en / fr / de / es, levels and advice
gladys-assistant-integration.json   manifest
docs/{en,fr,de,es}.md   user documentation, re-hosted by the store
docs/illustrations/     generated widget images (render.sh, gen.mjs, render.js)
test/fixtures/          real answers of the Airly API v2 (Home Assistant tests, Apache-2.0;
                        python-airly tests, MIT)
test/helpers/fake-api.js            the fake Airly API behind the `fetch` option
.github/scripts/release.mjs         version, changelog, bump (tested in test/)
```

## Rules

- **External ids are forever**, and so is every key users store: device and
  feature external ids (`place:installation-<id>`, `place:house-<house
selector>`: never a name nor coordinates), the feature keys, feature
  `category` / `type` / `unit` / `min` / `max` / `step`, the level keys
  (`very_low` … `very_high`), the keys of `config_schema`, `actions`, the
  widgets and their settings, scene triggers (fields, options, variables) and
  scene actions (fields, outputs). `test/structure.test.js` compares them to
  `test/fixtures/discovery.baseline.json`: never update the baseline to make a
  test pass without a documented migration.
- **Category / type pairs.** The CAQI and the forecast peak are
  `airquality-sensor` / `aqi`, unit AQI, 0-500; PM2.5, PM10, NO₂, O₃, SO₂ their
  own categories, `decimal`, µg/m³; temperature, humidity, pressure decimal;
  the level and the forecast `text` / `text`. PM1 has no category in Gladys and
  CO is a binary detector there: never features. A value Airly did not give is
  not published (a 0 would claim clean air).
- **Features never flap.** The optional features (weather, gases) are offered
  once the place gave them, kept in /data, and never removed.
- **Levels come from the value** (caqi.js), never from Airly's level names or
  texts (English or Polish only).
- **The daily limit is the user's.** One request per place per round; the
  plan (usage.js) spreads the limit minus a reserve of 10 over the day (30 min
  at least), stretched by what remains until midnight UTC. A 429 pauses
  everything until midnight UTC; a refused key stops until the configuration
  changes. A widget never reads; the Refresh button reads past 15 minutes, a
  scene action past an hour, both on the reserve.
- **`should_poll` stays false**: the integration has its own timer.
- **Secrets and privacy.** The key travels in the `apikey` header, never in a
  URL, never logged; the diagnostic says only whether it is set and never
  writes the coordinates of a house.
- **Events once.** `seen` (in /data) keeps the level of each place, the
  forecast alert in progress and the WHO guideline values exceeded. The first
  reading is a baseline. A scene action or a widget never fires an event.
- **Credit.** "Airly" and the hour of the data stay visible in the widgets;
  "Data provided by Airly" in the README, the docs and NOTICE.
- **The container rootfs is read-only.** Write only under `/data`.
- **Four languages.** Every user-facing text (manifest, runtime messages in
  `src/i18n.js`, `docs/*.md`, README) exists in English, French, German and
  Spanish. `test/i18n.test.js` checks it. German uses "du", Spanish "usted",
  like the Gladys interface. Place names and sensor addresses stay as they are.
- **Widget images.** After any change to the content of a widget, run
  `docs/illustrations/render.sh` again and look at the four PNG files.
- **Versions belong to the Release workflow**: never edit `version` in
  `package.json`, the lockfile or the manifest, nor the `docker_image` tag.
  The version stays below 1.0.0 until the maintainer runs the Release workflow
  with `release-as: 1.0.0`.
- **Changelog.** Never edit CHANGELOG.md by hand, it is generated at the
  release. Write the PR title as the line the user will read.
- **Commits and PR titles** follow Conventional Commits, in English: `feat` ->
  minor, `fix` / `perf` -> patch, `!` or `BREAKING CHANGE:` -> major (minor
  below 1.0.0); `docs`, `chore`, `ci`, `test`, `style`, `refactor`, `build`
  release nothing.
- **Manifest.** Texts are objects `{ "en", "fr", "de", "es" }`; the catalog
  `description` holds 10 to 100 characters per language; the file stays under
  100 KB. The house picker (`source: "houses"`) needs `gladys_version`
  `>=5.2.0` and `location: true` to read the coordinates. Transport:
  `["cloud"]`.
- **Forum drafts** (`.github/forum-*.md`) are never committed.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English. Tests never touch the network (the fake API of
  `test/helpers/fake-api.js`).
