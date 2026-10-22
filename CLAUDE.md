# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** for AirNow, the air quality
program of the U.S. EPA: a Node.js service (Node 22+, ESM, no build step) that
runs in its own sandboxed Docker container and talks to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
its only runtime dependency. It reads the 2026 services of the AirNow API
(`https://www.airnowapi.org`, a free key per user):
`/aq/observation/current/ziplatlong/` and `/aq/forecast/current/`, by ZIP code
or by the coordinates of a Gladys house, for up to three places. Transport:
cloud only. The services retired on 2026-09-30 are never used. Documentation:
https://docs.airnowapi.org (behind a login); the behaviour of the services is
the one observed and written down in
https://github.com/briandconnelly/airnow/blob/main/dev/superpowers/specs/2026-09-09-airnow-api-migration-design.md.

## Commands

```bash
npm install
npm test                                  # node --test, the built-in runner
node --test test/widgets.test.js          # one file
DEBUG=gladys-integration-sdk npm test     # with the SDK debug logs
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
src/airnow-api.js       HTTP client: the key in the query, WebServiceError read whatever the status, hourly budget
src/parse.js            observations and forecasts -> AQI per pollutant, overall AQI, days
src/aqi.js              the EPA scale: categories 1-6, names, pollutants
src/events.js           scene trigger transitions, payloads, scene action outputs
src/device.js           the place devices and their states
src/widgets.js          air quality and forecast dashboard widgets
src/store.js            /data/airnow.json: requests of the hour, last readings, `seen`
src/time.js             observation hours (end of the hour, zone abbreviations), formats
src/config.js           configuration (key, three places: house or ZIP code, language)
src/i18n.js             runtime texts, en / fr / de / es, categories and health messages
gladys-assistant-integration.json   manifest
docs/{en,fr,de,es}.md   user documentation, re-hosted by the store
docs/illustrations/     generated widget images (render.sh, gen.mjs, render.js)
test/fixtures/          real answers of the 2026 services (R package airnow, MIT)
test/helpers/fake-api.js            the fake AirNow API behind the `fetch` option
.github/scripts/release.mjs         version, changelog, bump (tested in test/)
```

## Rules

- **External ids are forever**, and so is every key users store: device and
  feature external ids (`place:zip-<ZIP code>`, `place:house-<house
selector>`), feature `category` / `type` / `unit` / `min` / `max` / `step`,
  the keys of `config_schema`, `actions`, the widgets and their settings,
  scene triggers (fields, options, variables) and scene actions (fields,
  outputs). `test/structure.test.js` compares them to
  `test/fixtures/discovery.baseline.json`: never update the baseline to make a
  test pass without a documented migration.
- **Category / type pairs.** Every AQI is `airquality-sensor` / `aqi`, unit
  AQI, 0-999 (smoke events exceed 500; the Gladys front colors this pair on the
  U.S. AQI scale); the category and the forecast are `text` / `text`. A value
  AirNow did not give is not published (a 0 would claim clean air).
- **`should_poll` stays false**: observations are read at hh:35 (AirNow
  publishes 10 to 30 minutes past the hour), forecasts every 3 hours, a failed
  reading tried again after 15 minutes, a refused key never again until the
  configuration changes. Readings are kept in /data. The client refuses past
  200 requests in a sliding hour (AirNow allows 500 per key).
- **Errors.** `WebServiceError` comes with 401 for a bad key and with 200 when
  there is no data near the place: read the body whatever the status. Never
  log the key (it travels in the query string); the diagnostic says only
  whether it is set.
- **Data use guidelines** of AirNow: show the agency and that the data are
  preliminary (widgets, README, docs, NOTICE); never alter values or the
  forecasters' discussions.
- **Events once.** `seen` (in /data) keeps the category now, the forecast
  category of each day and the action days announced per place. The first
  reading is a baseline (an action day already announced still fires). A scene
  action or a widget never fires an event.
- **The container rootfs is read-only.** Write only under `/data`.
- **Four languages.** Every user-facing text (manifest, runtime messages in
  `src/i18n.js`, `docs/*.md`, README) exists in English, French, German and
  Spanish. `test/i18n.test.js` checks it. German uses "du", Spanish "usted",
  like the Gladys interface. Reporting areas and agencies stay in English.
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
