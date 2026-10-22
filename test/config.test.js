import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalizeConfig, readZip, readLanguage } from '../src/config.js';

test('places: a ZIP code wins over a house; empty slots are left out', () => {
  assert.deepEqual(
    normalizeConfig({ api_key: ' k ', zip_1: '90210', house_1: 'home', house_3: 'cabin' }),
    {
      apiKey: 'k',
      places: [
        { slot: 1, zip: '90210', house: null, invalidZip: null },
        { slot: 3, zip: null, house: 'cabin', invalidZip: null },
      ],
      language: 'auto',
    },
  );
});

test('ZIP codes as users type them', () => {
  assert.equal(readZip('02115-4402'), '02115');
  assert.equal(readZip('021154402'), '02115');
  assert.equal(readZip(2115), '02115', 'a number loses its leading 0');
  assert.equal(readZip('9021'), null);
  assert.equal(readZip('H0H 0H0'), null);
  assert.deepEqual(normalizeConfig({ zip_2: 'abc' }).places, [
    { slot: 2, zip: null, house: null, invalidZip: 'abc' },
  ]);
  assert.equal(readLanguage({ last_language: 'es' }, 'en'), 'es');
  assert.equal(normalizeConfig({ language: 'de' }).language, 'de');
});
