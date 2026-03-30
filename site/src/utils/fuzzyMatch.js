// 繁体→简体映射表（歌曲标题常见字）
const TRAD_TO_SIMP = {
  '愛':'爱','葉':'叶','語':'语','風':'风','夢':'梦','戀':'恋','傷':'伤',
  '歲':'岁','時':'时','間':'间','書':'书','長':'长','開':'开','門':'门',
  '見':'见','問':'问','聽':'听','說':'说','話':'话','請':'请','讓':'让',
  '東':'东','雲':'云','飛':'飞','鳥':'鸟','魚':'鱼','龍':'龙','鳳':'凤',
  '華':'华','國':'国','園':'园','場':'场','島':'岛','陽':'阳','陰':'阴',
  '電':'电','車':'车','機':'机','關':'关','運':'运','動':'动','靜':'静',
  '紅':'红','藍':'蓝','綠':'绿','銀':'银','經':'经','線':'线','練':'练',
  '體':'体','頭':'头','臉':'脸','淚':'泪','聲':'声','響':'响',
  '樂':'乐','調':'调','詞':'词','節':'节','義':'义','禮':'礼',
  '離':'离','遠':'远','還':'还','過':'过','後':'后','裡':'里','邊':'边',
  '點':'点','燈':'灯','滿':'满','無':'无','盡':'尽','難':'难','單':'单',
  '雙':'双','親':'亲','對':'对','從':'从','當':'当','實':'实','與':'与',
  '為':'为','個':'个','這':'这','們':'们','來':'来','馬':'马',
  '寶':'宝','貝':'贝','記':'记','設':'设','試':'试','認':'认','識':'识',
  '應':'应','號':'号','傳':'传','統':'统','總':'总','將':'将',
  '達':'达','張':'张','許':'许','論':'论','獨':'独',
  '層':'层','覺':'觉','戰':'战','續':'续','類':'类','絲':'丝','處':'处',
  '復':'复','創':'创','衛':'卫','環':'环','產':'产',
  '專':'专','結':'结','殺':'杀','確':'确','碼':'码','領':'领','飄':'飘',
  '麗':'丽','歡':'欢','買':'买','賣':'卖','學':'学','廣':'广','滅':'灭',
  '條':'条','養':'养','勝':'胜','敗':'败','藝':'艺','術':'术','塵':'尘',
  '憶':'忆','靈':'灵','寧':'宁','鑰':'钥','鎖':'锁','錢':'钱','鐵':'铁',
  '鏡':'镜','濕':'湿','溫':'温','準':'准','災':'灾','壞':'坏','佈':'布',
  '歷':'历','曆':'历','僅':'仅','優':'优','償':'偿','億':'亿',
  '煙':'烟','獻':'献','瘋':'疯','療':'疗','癡':'痴','盤':'盘',
  '禪':'禅','穩':'稳','競':'竞','純':'纯','納':'纳',
  '終':'终','緣':'缘','繼':'继','織':'织','聖':'圣',
  '腦':'脑','舊':'旧','莊':'庄','萬':'万','蘭':'兰',
  '螢':'萤','訴':'诉','詩':'诗','誰':'谁','諾':'诺','譜':'谱',
  '變':'变','貓':'猫','趙':'赵','輕':'轻','輝':'辉','轉':'转',
  '鄰':'邻','釋':'释','鋼':'钢','錄':'录','閃':'闪','閱':'阅',
  '陳':'陈','隨':'随','雜':'杂','頻':'频','顏':'颜',
  '願':'愿','驚':'惊','鬧':'闹',
}

function toSimplified(text) {
  if (!text) return ''
  let result = ''
  for (let i = 0; i < text.length; i++) {
    result += TRAD_TO_SIMP[text[i]] || text[i]
  }
  return result
}

function normalizeSymbols(text) {
  return text
    .normalize('NFKC')
    .replace(/[♯＃]/g, '#')
    .replace(/[꞉∶﹕：]/g, ':')
    .replace(/[。，、；：？！""''（）【】《》…—～·「」『』〈〉﹏]+/g, '')
    .replace(/[!?;'"`,\.]+/g, '')
}

export function normalizeSearch(text) {
  if (!text) return ''
  return normalizeSymbols(
    toSimplified(text.toLowerCase())
      .replace(/[\s]+/g, ' ').trim()
  )
}

// 提取中文字符
function extractChinese(text) {
  if (!text) return ''
  return text.match(/[\u4e00-\u9fff]/g)?.join('') || ''
}

// 子序列匹配：检查 needle 的每个字符是否按顺序出现在 haystack 中
function isSubsequence(needle, haystack) {
  let ni = 0
  for (let hi = 0; hi < haystack.length && ni < needle.length; hi++) {
    if (haystack[hi] === needle[ni]) ni++
  }
  return ni === needle.length
}

// 预计算搜索索引
export function buildSearchIndex(songs, pinyinFn) {
  return songs.map(song => {
    const titleCN = extractChinese(song.title)
    const artistCN = extractChinese(song.artist)

    return {
      titleNorm: normalizeSearch(song.title),
      artistNorm: normalizeSearch(song.artist),
      lyricsNorm: normalizeSearch(song.lyrics),
      // 全拼（无声调无空格）
      titlePinyin: titleCN ? pinyinFn(titleCN, { toneType: 'none', type: 'array' }).join('') : '',
      artistPinyin: artistCN ? pinyinFn(artistCN, { toneType: 'none', type: 'array' }).join('') : '',
      // 拼音首字母
      titleInitials: titleCN ? pinyinFn(titleCN, { pattern: 'first', toneType: 'none', type: 'array' }).join('') : '',
      artistInitials: artistCN ? pinyinFn(artistCN, { pattern: 'first', toneType: 'none', type: 'array' }).join('') : '',
    }
  })
}

// 关键词搜索 + 相关性评分
export function searchSongs(songs, searchIndex, searchTerm, pinyinFn) {
  const keywords = searchTerm.trim().split(/\s+/).filter(k => k.length > 0)
  if (keywords.length === 0) return []

  // 预计算用户输入的拼音（用于同音字匹配），只算一次
  const keywordMeta = keywords.map(kw => {
    const norm = normalizeSearch(kw)
    const lower = kw.toLowerCase().replace(/\s/g, '')
    const cn = extractChinese(kw)
    const cnPinyin = cn ? pinyinFn(cn, { toneType: 'none', type: 'array' }).join('') : ''
    return { norm, lower, cnPinyin }
  })

  const scored = songs.map((song, i) => {
    const idx = searchIndex[i]
    if (!idx) return null

    let totalScore = 0

    for (const kw of keywordMeta) {
      let kwScore = 0

      // 规范化文本包含
      if (kw.norm && idx.titleNorm.includes(kw.norm)) kwScore = Math.max(kwScore, 10)
      if (kw.norm && idx.artistNorm.includes(kw.norm)) kwScore = Math.max(kwScore, 8)

      // 全拼匹配
      if (kw.lower && idx.titlePinyin && idx.titlePinyin.includes(kw.lower)) kwScore = Math.max(kwScore, 6)
      if (kw.lower && idx.artistPinyin && idx.artistPinyin.includes(kw.lower)) kwScore = Math.max(kwScore, 5)

      // 拼音首字母匹配（至少2个字符）
      if (kw.lower.length >= 2) {
        if (idx.titleInitials && idx.titleInitials.includes(kw.lower)) kwScore = Math.max(kwScore, 4)
        if (idx.artistInitials && idx.artistInitials.includes(kw.lower)) kwScore = Math.max(kwScore, 4)
      }

      // 同音字匹配（输入含中文时，转拼音后与索引拼音比较）
      if (kw.cnPinyin) {
        if (idx.titlePinyin && idx.titlePinyin.includes(kw.cnPinyin)) kwScore = Math.max(kwScore, 3)
        if (idx.artistPinyin && idx.artistPinyin.includes(kw.cnPinyin)) kwScore = Math.max(kwScore, 3)
      }

      // 子序列匹配（字符按序出现在标题/歌手中）
      if (kw.norm && kw.norm.length >= 2) {
        if (isSubsequence(kw.norm, idx.titleNorm)) kwScore = Math.max(kwScore, 2)
        if (isSubsequence(kw.norm, idx.artistNorm)) kwScore = Math.max(kwScore, 1.5)
      }

      // 歌词匹配（最低优先级）
      if (kwScore === 0 && kw.norm && idx.lyricsNorm.includes(kw.norm)) kwScore = 1

      totalScore += kwScore
    }

    return totalScore > 0 ? { song, score: totalScore } : null
  }).filter(Boolean)

  scored.sort((a, b) => b.score - a.score)
  return scored.map(s => s.song)
}
