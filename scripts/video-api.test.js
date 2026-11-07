const test = require('node:test')
const assert = require('node:assert/strict')
const { getMixinKey, signWbi, fetchLatestVideos } = require('./update-schedule')

const imgKey = '7cd084941338484aae1ad9425b84077c'
const subKey = '4932caff0ff746eab6f01bf08b70ac45'
const video = {
  title: '测试投稿',
  bvid: 'BV1test',
  pic: 'https://example.com/video.jpg',
  created: 1791885600,
  play: 100,
  length: '01:32',
}

function jsonResponse(payload) {
  return { ok: true, status: 200, json: async () => payload }
}

function navResponse() {
  return jsonResponse({
    code: -101,
    data: {
      wbi_img: {
        img_url: `https://i0.hdslb.com/bfs/wbi/${imgKey}.png`,
        sub_url: `https://i0.hdslb.com/bfs/wbi/${subKey}.png`,
      },
    },
  })
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

test('WBI 口令重排与签名符合公开样例', () => {
  assert.equal(getMixinKey(imgKey, subKey), 'ea1db124af3c7062474693fa704f4ff8')
  assert.equal(
    signWbi({ foo: '114', bar: '514', zab: '1919810' }, imgKey, subKey, 1702204169),
    'bar=514&foo=114&wts=1702204169&zab=1919810&w_rid=8f6f2b5b3d485fe1886cec6a0be8c5d4',
  )
})

test('视频请求使用签名后的 WBI 接口', async () => {
  const urls = []
  const videos = await mockFetch(async url => {
    urls.push(String(url))
    if (String(url).includes('/x/web-interface/nav')) return navResponse()
    return jsonResponse({ code: 0, data: { list: { vlist: [video] } } })
  }, () => fetchLatestVideos('613345189', 4, async () => {}))

  assert.equal(videos.length, 1)
  assert.equal(videos[0].bvid, 'BV1test')
  assert.equal(urls.length, 2)
  const request = new URL(urls[1])
  assert.equal(request.pathname, '/x/space/wbi/arc/search')
  assert.equal(request.searchParams.get('mid'), '613345189')
  assert.equal(request.searchParams.get('ps'), '4')
  assert.ok(request.searchParams.get('wts'))
  assert.match(request.searchParams.get('w_rid'), /^[0-9a-f]{32}$/)
})

test('空投稿列表会重试，成功后返回有效数据', async () => {
  let videoRequests = 0
  let retries = 0
  const videos = await mockFetch(async url => {
    if (String(url).includes('/x/web-interface/nav')) return navResponse()
    videoRequests += 1
    const vlist = videoRequests === 1 ? [] : [video]
    return jsonResponse({ code: 0, data: { list: { vlist } } })
  }, () => fetchLatestVideos('613345189', 4, async () => { retries += 1 }))

  assert.equal(videos.length, 1)
  assert.equal(videoRequests, 2)
  assert.equal(retries, 1)
})

test('持续返回空投稿列表时拒绝写入结果', async () => {
  let videoRequests = 0
  await mockFetch(async url => {
    if (String(url).includes('/x/web-interface/nav')) return navResponse()
    videoRequests += 1
    return jsonResponse({ code: 0, data: { list: { vlist: [] } } })
  }, async () => {
    await assert.rejects(fetchLatestVideos('613345189', 4, async () => {}), /空投稿列表/)
  })
  assert.equal(videoRequests, 6)
})
