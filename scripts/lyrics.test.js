const test = require('node:test')
const assert = require('node:assert/strict')
const { cleanLyrics } = require('./lyrics')

test('清理 LRC 元数据与时间戳', () => {
  const input = '[ti:Lemon]\n[ar:米津玄師]\n[offset:0]\n[00:01.00]第一句歌词\n[00:05.20]第二句歌词'
  assert.equal(cleanLyrics(input), '第一句歌词\n第二句歌词')
})

test('清理 kana 扩展标签并保留普通方括号', () => {
  assert.equal(cleanLyrics('[kana:1よね1づ]\n[Chorus]\n歌詞'), '[Chorus]\n歌詞')
})

test('处理空值与多余空行', () => {
  assert.equal(cleanLyrics(null), '')
  assert.equal(cleanLyrics('第一句\n\n\n\n第二句'), '第一句\n\n第二句')
})
