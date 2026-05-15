const test = require('node:test');
const assert = require('node:assert');
const { resolveArtistAlias } = require('./aliases');

test('单一歌手命中别名', () => {
  assert.strictEqual(resolveArtistAlias('Aimer'), 'Aimer (エメ)');
  assert.strictEqual(resolveArtistAlias('米津玄師'), '米津玄師 (よねづ けんし)');
});

test('单一歌手未命中保持原样', () => {
  assert.strictEqual(resolveArtistAlias('Adele'), 'Adele');
});

test('多创作者按 / 切分逐个映射', () => {
  assert.strictEqual(resolveArtistAlias('Aimer/chelly'), 'Aimer (エメ)/chelly');
  assert.strictEqual(resolveArtistAlias('Aimer/米津玄師'), 'Aimer (エメ)/米津玄師 (よねづ けんし)');
});

test('空值与 falsy 输入', () => {
  assert.strictEqual(resolveArtistAlias(''), '');
  assert.strictEqual(resolveArtistAlias(null), null);
  assert.strictEqual(resolveArtistAlias(undefined), undefined);
});

test('已经是标准名（带括号版）保持原样', () => {
  assert.strictEqual(resolveArtistAlias('Aimer (エメ)'), 'Aimer (エメ)');
});
