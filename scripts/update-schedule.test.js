const test = require('node:test')
const assert = require('node:assert/strict')
const {
  findLatestSchedule,
  normalizeSchedule,
  normalizeVideo,
  getWeekRange,
  shouldUpdateSchedule,
} = require('./update-schedule')

const olderPinned = {
  id_str: '100',
  modules: [
    { module_author: { is_top: true, pub_ts: 1793085038 } },
    { module_desc: { text: '10.26-11.1 的周表' } },
    { module_dynamic: { dyn_draw: { items: [{ src: 'http://example.com/old.png' }] } } },
  ],
}
const latestSchedule = {
  id_str: '200',
  modules: [
    { module_author: { is_top: false, pub_ts: 1793707031 } },
    { module_desc: { text: '11.2-11.8 的周表来了！请查收\n\n本周直播亮点' } },
    { module_dynamic: { dyn_draw: { items: [{ src: 'http://example.com/cover.png' }] } } },
  ],
}
const unrelated = {
  id_str: '300',
  modules: [{ module_author: { pub_ts: 1793800000 } }, { module_desc: { text: '普通动态' } }],
}

test('选择最近一条文字包含周表的动态，不受置顶状态影响', () => {
  assert.equal(findLatestSchedule([olderPinned, unrelated, latestSchedule]), latestSchedule)
  assert.equal(findLatestSchedule([olderPinned, unrelated]), olderPinned)
})

test('没有周表时返回 undefined', () => {
  assert.equal(findLatestSchedule([unrelated]), undefined)
  assert.equal(findLatestSchedule([]), undefined)
})

test('根据动态发布时间计算北京时间所在的周一至周日', () => {
  assert.deepEqual(getWeekRange(1793707031 * 1000), {
    weekStart: '2026-11-02',
    weekEnd: '2026-11-08',
    weekLabel: '2026.11.02 – 11.08',
  })
})

test('规范化周表链接、标题、封面和所在周', () => {
  const result = normalizeSchedule(latestSchedule)
  assert.equal(result.url, 'https://www.bilibili.com/opus/200')
  assert.equal(result.title, '11.2-11.8 的周表来了！请查收')
  assert.equal(result.cover, 'https://example.com/cover.png')
  assert.equal(result.weekLabel, '2026.11.02 – 11.08')
  assert.equal(result.publishedAt, new Date(1793707031 * 1000).toISOString())
})

test('兼容只有 jump_url 的动态', () => {
  assert.equal(normalizeSchedule({ jump_url: '//www.bilibili.com/opus/300', content: '周表' }).url, 'https://www.bilibili.com/opus/300')
})

test('同一条周表不覆盖，新周表才更新，旧周表不回滚', () => {
  const current = { opusId: '200', publishedAt: '2026-11-03T00:00:00.000Z', weekLabel: '2026.11.02 – 11.08', image: 'schedule.webp' }
  assert.equal(shouldUpdateSchedule({ opusId: '200' }, current, true), false)
  assert.equal(shouldUpdateSchedule({ opusId: '201', publishedAt: '2026-11-04T00:00:00.000Z' }, current, true), true)
  assert.equal(shouldUpdateSchedule({ opusId: '199', publishedAt: '2026-11-01T00:00:00.000Z' }, current, true), false)
  assert.equal(shouldUpdateSchedule({ opusId: '200' }, current, false), true)
  assert.equal(shouldUpdateSchedule(null, current, true), false)
})

test('规范化最新视频数据', () => {
  assert.deepEqual(normalizeVideo({
    title: '测试投稿', bvid: 'BV1test', pic: 'http://example.com/video.jpg', created: 1791885600, play: 6131, length: '01:32',
  }), {
    title: '测试投稿',
    bvid: 'BV1test',
    url: 'https://www.bilibili.com/video/BV1test',
    cover: 'https://example.com/video.jpg',
    publishedAt: '2026-10-13T10:00:00.000Z',
    play: 6131,
    duration: '01:32',
  })
})

test('缺少视频关键字段时拒绝写入', () => {
  assert.throws(() => normalizeVideo({ title: '缺少 BV 号' }), /BV 号/)
})
