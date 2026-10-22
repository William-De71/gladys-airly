// -----------------------------------------------------------------------------
// What the integration keeps across restarts, in /data/airly.json (the only
// writable place of the container):
//   - `usage`     the requests of the UTC day and the limit of the key: a
//                 restart never spends the day twice;
//   - `places`    the last reading of each place and when it was read, the
//                 installation it shows, the features it ever gave (they only
//                 grow: a feature never flaps);
//   - `seen`      what the scene triggers already know: the level of each
//                 place, the forecast alert in progress, the WHO guideline
//                 values exceeded. A restart never fires twice.
// -----------------------------------------------------------------------------

import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const DEFAULT_PATH = '/data/airly.json';
const EMPTY = () => ({
  usage: null,
  places: {},
  seen: { level: {}, forecast: {}, who: {} },
});

/**
 * @description The store.
 * @param {object} [options] - `{ path, logger }`.
 * @returns {object} `{ data, load, save }`.
 */
function createStore({ path = DEFAULT_PATH, logger } = {}) {
  const store = {
    data: EMPTY(),
    /**
     * @description Read the file; an absent or broken file is an empty store.
     * @returns {Promise<void>}
     */
    async load() {
      try {
        const raw = JSON.parse(await readFile(path, 'utf8'));
        const base = EMPTY();
        const value = raw && typeof raw === 'object' ? raw : {};
        const part = (node) => (node && typeof node === 'object' && !Array.isArray(node) ? node : {});
        store.data.usage = value.usage && typeof value.usage === 'object' ? value.usage : null;
        store.data.places = { ...part(value.places) };
        store.data.seen = { ...base.seen };
        for (const key of Object.keys(base.seen)) {
          store.data.seen[key] = { ...part(part(value.seen)[key]) };
        }
      } catch (err) {
        if (err.code !== 'ENOENT') {
          logger?.warn(`Unable to read ${path}: ${err.message}`);
        }
      }
    },
    /**
     * @description Write the file (atomically: a temporary file, then a rename).
     * @returns {Promise<void>}
     */
    async save() {
      try {
        await mkdir(dirname(path), { recursive: true });
        const temporary = `${path}.tmp`;
        await writeFile(temporary, JSON.stringify(store.data));
        await rename(temporary, path);
      } catch (err) {
        logger?.warn(`Unable to write ${path}: ${err.message}`);
      }
    },
  };
  return store;
}

export { DEFAULT_PATH, createStore };
