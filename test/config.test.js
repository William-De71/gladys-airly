import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalizeConfig, readInstallationId, readLanguage } from '../src/config.js';

test('places: a sensor wins over a house; empty slots are left out', () => {
  assert.deepEqual(
    normalizeConfig({
      api_key: ' k ',
      installation_1: '204',
      house_1: 'home',
      house_3: 'cabin',
      house_mode: 'nearest',
    }),
    {
      apiKey: 'k',
      places: [
        { slot: 1, installationId: 204, house: null, invalidInstallation: null },
        { slot: 3, installationId: null, house: 'cabin', invalidInstallation: null },
      ],
      houseMode: 'nearest',
      language: 'auto',
    },
  );
  assert.equal(normalizeConfig({ house_mode: 'other' }).houseMode, 'point');
  assert.equal(normalizeConfig(null).apiKey, '');
});

test('sensor numbers as users type or paste them', () => {
  assert.equal(readInstallationId('204'), 204);
  assert.equal(readInstallationId(8077), 8077);
  assert.equal(readInstallationId(' i8077 '), 8077);
  assert.equal(readInstallationId('https://airly.org/map/en/#50.06,19.94,i8077'), 8077);
  assert.equal(readInstallationId('https://airly.org/map/en/#50.06,19.94'), null);
  assert.equal(readInstallationId('0'), null);
  assert.equal(readInstallationId('Kraków'), null);
  assert.deepEqual(normalizeConfig({ installation_2: 'abc' }).places, [
    { slot: 2, installationId: null, house: null, invalidInstallation: 'abc' },
  ]);
  assert.equal(readLanguage({ last_language: 'es' }, 'en'), 'es');
  assert.equal(readLanguage({ last_language: 'xx-yy' }, 'en'), 'en');
  assert.equal(normalizeConfig({ language: 'de' }).language, 'de');
});
