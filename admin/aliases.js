const fs = require('fs');
const path = require('path');

const ALIASES_PATH = path.join(__dirname, 'aliases.json');

let cache = null;

function loadAliases() {
  if (cache !== null) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(ALIASES_PATH, 'utf-8'));
  } catch (e) {
    console.warn('[aliases] 无法读取 aliases.json，使用空表:', e.message);
    cache = {};
  }
  return cache;
}

function resolveArtistAlias(name) {
  if (!name) return name;
  const aliases = loadAliases();
  return name
    .split('/')
    .map(part => aliases[part] || part)
    .join('/');
}

module.exports = { resolveArtistAlias, loadAliases };
