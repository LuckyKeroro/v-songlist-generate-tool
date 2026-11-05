function cleanLyrics(value) {
  if (!value) return ''
  return String(value)
    .split(/\r?\n/)
    .filter(line => !/^\s*\[[a-z][a-z0-9_-]*:/i.test(line))
    .map(line => line.replace(/\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]/g, '').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

module.exports = { cleanLyrics }
