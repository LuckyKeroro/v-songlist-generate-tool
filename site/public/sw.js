try {
  importScripts('./sw-manifest.js')
} catch {}

const MANIFEST = self.__KERORO_CACHE__ || {
  version: 'fallback',
  shell: ['./', './index.html'],
  static: [],
}
const SHELL_PREFIX = 'keroro-songlist-shell-'
const SHELL_CACHE = `${SHELL_PREFIX}${MANIFEST.version}`
const STATIC_CACHE = 'keroro-songlist-static-v1'

async function storeResponse(cache, request, response) {
  if (response.ok) await cache.put(request, response.clone())
  return response
}

async function precache() {
  const shell = await caches.open(SHELL_CACHE)
  await shell.addAll(MANIFEST.shell)

  const staticCache = await caches.open(STATIC_CACHE)
  await Promise.all(MANIFEST.static.map(async url => {
    const cached = await caches.match(url)
    if (cached) {
      await staticCache.put(url, cached)
      return
    }
    const response = await fetch(url)
    if (!response.ok) throw new Error(`缓存资源失败: ${url}`)
    await staticCache.put(url, response)
  }))
}

async function activate() {
  const names = await caches.keys()
  await Promise.all(names
    .filter(name => name.startsWith(SHELL_PREFIX) && name !== SHELL_CACHE)
    .map(name => caches.delete(name)))

  const expected = new Set(MANIFEST.static.map(url => new URL(url, self.registration.scope).href))
  const staticCache = await caches.open(STATIC_CACHE)
  const requests = await staticCache.keys()
  await Promise.all(requests.map(request => {
    const url = new URL(request.url)
    const managed = url.pathname.includes('/assets/') || (url.searchParams.has('v') && !url.pathname.includes('/covers/'))
    if (managed && !expected.has(request.url)) return staticCache.delete(request)
    return undefined
  }))
  await self.clients.claim()
}

function cacheStrategy(url) {
  if (url.searchParams.has('v') || url.pathname.includes('/assets/')) return 'cache-first'
  return 'network-first'
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  return storeResponse(cache, request, response)
}

async function networkFirst(request, navigation = false) {
  const cache = await caches.open(SHELL_CACHE)
  try {
    const response = await fetch(request)
    return await storeResponse(cache, request, response)
  } catch (error) {
    const cached = await cache.match(request)
    if (cached) return cached
    if (navigation) {
      const fallback = await cache.match('./index.html')
      if (fallback) return fallback
    }
    throw error
  }
}

self.addEventListener('install', event => {
  event.waitUntil(precache().then(() => self.skipWaiting()))
})

self.addEventListener('activate', event => {
  event.waitUntil(activate())
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (/\/sw(?:-manifest)?\.js$/.test(url.pathname)) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, true))
  } else if (cacheStrategy(url) === 'cache-first') {
    event.respondWith(cacheFirst(request))
  } else {
    event.respondWith(networkFirst(request))
  }
})
