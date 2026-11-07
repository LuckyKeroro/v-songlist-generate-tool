const test = require('node:test')
const assert = require('node:assert/strict')
const { fetchSchedule, findLatestSchedule } = require('./update-schedule')

const scheduleItem = {
  opus_id: '200',
  jump_url: '//www.bilibili.com/opus/200',
  content: '11.2-11.8 的周表来了！请查收\n本周直播安排',
  cover: { url: 'http://example.com/schedule.png' },
}
const unrelated = {
  opus_id: '300',
  jump_url: '//www.bilibili.com/opus/300',
  content: '普通动态',
  cover: null,
}

function jsonResponse(payload) {
  return { ok: true, status: 200, json: async () => payload }
}

async function mockFetch(handler, run) {
  const originalFetch = global.fetch
  global.fetch = handler
  try {
    return await run()
  } finally {
    global.fetch = originalFetch
  }
}

test('周表使用空间图文列表和详情发布时间', async () => {
  const urls = []
  const schedule = await mockFetch(async (url, options) => {
    urls.push(String(url))
    if (String(url).includes('/opus/feed/space')) {
      return jsonResponse({ code: 0, data: { items: [unrelated, scheduleItem] } })
    }
    if (String(url).includes('/frontend/finger/spi')) {
      return jsonResponse({ code: 0, data: { b_3: 'public-device' } })
    }
    if (String(url).includes('/opus/detail')) {
      assert.equal(options.headers.Cookie, 'buvid3=public-device')
      return jsonResponse({
        code: 0,
        data: { item: { id_str: '200', modules: [{ module_author: { pub_ts: '1793707031' } }] } },
      })
    }
    throw new Error(`意外请求: ${url}`)
  }, () => fetchSchedule('613345189', async () => {}))

  assert.equal(urls.length, 3)
  assert.equal(new URL(urls[0]).pathname, '/x/polymer/web-dynamic/v1/opus/feed/space')
  assert.equal(new URL(urls[0]).searchParams.get('type'), 'dynamic')
  assert.equal(new URL(urls[2]).searchParams.get('id'), '200')
  assert.equal(schedule.opusId, '200')
  assert.equal(schedule.cover, 'https://example.com/schedule.png')
  assert.equal(schedule.publishedAt, '2026-11-03T11:57:11.000Z')
  assert.equal(schedule.weekLabel, '2026.11.02 – 11.08')
})

test('兼容对象形式的动态模块', () => {
  const item = {
    id_str: '200',
    modules: {
      module_author: { pub_ts: '1793707031' },
      module_desc: { text: '本周周表' },
    },
  }
  assert.equal(findLatestSchedule([item]), item)
})

test('没有文字包含周表的图文时不请求详情', async () => {
  let requests = 0
  const schedule = await mockFetch(async () => {
    requests += 1
    return jsonResponse({ code: 0, data: { items: [unrelated] } })
  }, () => fetchSchedule('613345189', async () => {}))

  assert.equal(schedule, null)
  assert.equal(requests, 1)
})

test('周表接口持续返回空列表时保留失败状态', async () => {
  let requests = 0
  let retries = 0
  await mockFetch(async () => {
    requests += 1
    return jsonResponse({ code: 0, data: { items: [] } })
  }, async () => {
    await assert.rejects(fetchSchedule('613345189', async () => { retries += 1 }), /空列表/)
  })

  assert.equal(requests, 6)
  assert.equal(retries, 5)
})
