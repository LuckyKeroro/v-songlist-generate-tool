const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const source = fs.readFileSync(path.join(__dirname, '..', 'site', 'public', 'sw.js'), 'utf8')
const scope = 'https://www.wckrr.com/'

function fakeResponse(body) {
  return {
    ok: true,
    body,
    clone() {
      return fakeResponse(body)
    },
  }
}

function createWorker(fetchImpl) {
  const entries = new Map()
  const keyFor = request => new URL(typeof request === 'string' ? request : request.url, scope).href
  const cache = {
    match: async request => entries.get(keyFor(request)),
    put: async (request, response) => entries.set(keyFor(request), response),
  }
  const context = {
    self: {
      location: new URL(scope),
      registration: { scope },
      clients: { claim: async () => {} },
      addEventListener: () => {},
      skipWaiting: async () => {},
    },
    caches: {
      open: async () => cache,
      match: async request => cache.match(request),
    },
    fetch: fetchImpl,
    importScripts: () => {},
    URL,
  }
  vm.runInNewContext(source, context)
  return { context, entries, keyFor }
}

test('带版本号的资源和构建资产优先使用缓存', () => {
  const { context } = createWorker(async () => fakeResponse('unused'))
  assert.equal(context.cacheStrategy(new URL(`${scope}assets/index-a1b2c3.js`)), 'cache-first')
  assert.equal(context.cacheStrategy(new URL(`${scope}background.jpg?v=a1b2c3`)), 'cache-first')
  assert.equal(context.cacheStrategy(new URL(`${scope}songs.json?v=a1b2c3`)), 'cache-first')
  assert.equal(context.cacheStrategy(new URL(`${scope}config.json`)), 'network-first')
  assert.equal(context.cacheStrategy(new URL(`${scope}songs.json`)), 'network-first')
})

test('缓存命中时不重复请求网络资源', async () => {
  let requests = 0
  const { context, entries, keyFor } = createWorker(async () => {
    requests += 1
    return fakeResponse('network')
  })
  const request = { url: `${scope}background.jpg?v=a1b2c3` }
  entries.set(keyFor(request), fakeResponse('cached'))

  const response = await context.cacheFirst(request)
  assert.equal(response.body, 'cached')
  assert.equal(requests, 0)
})

test('首次请求后写入缓存，后续复用', async () => {
  let requests = 0
  const { context } = createWorker(async () => {
    requests += 1
    return fakeResponse('fresh')
  })
  const request = { url: `${scope}songs.json?v=a1b2c3` }

  assert.equal((await context.cacheFirst(request)).body, 'fresh')
  assert.equal((await context.cacheFirst(request)).body, 'fresh')
  assert.equal(requests, 1)
})

test('配置在线更新并回写缓存', async () => {
  const { context, entries, keyFor } = createWorker(async () => fakeResponse('new'))
  const request = { url: `${scope}config.json` }
  entries.set(keyFor(request), fakeResponse('old'))

  assert.equal((await context.networkFirst(request)).body, 'new')
  assert.equal(entries.get(keyFor(request)).body, 'new')
})

test('断网时回退到已有配置和入口页面', async () => {
  const { context, entries } = createWorker(async () => {
    throw new Error('offline')
  })
  const request = { url: `${scope}config.json` }
  entries.set(request.url, fakeResponse('cached config'))
  entries.set(`${scope}index.html`, fakeResponse('cached page'))

  assert.equal((await context.networkFirst(request)).body, 'cached config')
  assert.equal((await context.networkFirst({ url: `${scope}schedule` }, true)).body, 'cached page')
})
