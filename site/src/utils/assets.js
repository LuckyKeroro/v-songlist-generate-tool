export function assetUrl(path) {
  if (!path) return ''
  if (/^(https?:|data:|blob:)/.test(path)) return path
  const base = import.meta.env.BASE_URL || './'
  return `${base}${String(path).replace(/^\//, '')}`
}
