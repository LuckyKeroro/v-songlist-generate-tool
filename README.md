# 蛙吹Keroro·不完整歌单

蛙吹 Keroro 的非官方粉丝歌单。采用奶油白、苔绿与荧光嫩绿的视觉，保留完整歌曲数据、本地管理工作流和 GitHub Pages 自动部署。

线上站点：[www.wckrr.com](https://www.wckrr.com/) · GitHub：[v-songlist-generate-tool](https://github.com/LuckyKeroro/v-songlist-generate-tool)

## 功能

- 歌名、歌手、专辑、年份、语言与歌词搜索，支持拼音、首字母、繁简与相关度排序
- 点击歌名、歌手、专辑、年份对应的表头排序；语言使用自定义下拉菜单筛选
- 点击封面查看歌曲卡片；点击歌名或行内空白复制 `点歌 歌名`；点击歌手、专辑、年份或语言筛选
- 随机选歌、歌曲详情、歌词查看、字母导航滚动高亮与回到顶部按钮
- 小蛙 favicon、绿色自定义鼠标指针，以及歌曲和歌词共用的滚动时半透明滑块
- 静态资源按内容版本缓存，重复访问减少下载，断网时可回退到已缓存页面
- 本地歌曲管理：Excel 批量导入、手动添加、编辑与删除
- QQ 音乐/网易云音乐元数据搜索，封面、歌词和发行信息获取
- 主播信息、插画、头像和导航链接管理
- 页内展示周表图片与最新四条视频，GitHub Actions 每日更新并部署

## 快速开始

要求 Node.js 22+ 和 npm。仓库使用 npm workspaces，只需在根目录安装一次依赖。

```bash
npm install
```

### 开发前台

```bash
npm run dev
```

访问 http://localhost:5173。开发服务器读取 `site/public/` 中最近一次生成的数据；修改歌曲或配置后运行 `npm run build`。

### 打开管理工具

```bash
npm run admin
```

- 管理端：http://localhost:3001
- 已生成网站预览：http://localhost:3000

管理工具只监听 `127.0.0.1`。Excel 第一列是歌名，第二列是可选歌手；支持 `.xlsx` 和 `.xls`。请只导入可信来源的文件：当前 SheetJS npm 版本仍有未修复的安全公告，不建议用它解析不可信文件。

### 构建与测试

```bash
npm run update:schedule  # 获取最近周表与最新视频
npm run build            # 处理数据与图片，生成 dist/
npm run preview          # 本地检查 dist/
npm test                 # Node.js 单元测试
```

## 周表图片与视频自动更新

`scripts/update-schedule.js` 调用两个 Bilibili 公开接口：

```text
https://api.bilibili.com/x/polymer/web-dynamic/desktop/v1/feed/space
https://api.bilibili.com/x/space/arc/search
```

脚本从 `public/config.json` 读取 `schedule.mid`（当前为 `613345189`），按发布时间选择最近一条文字内容包含“周表”的动态，不使用置顶状态作为判断条件。根据动态发布时间的北京时间计算其所在周（周一至周日），下载封面为 `public/schedule.webp`，并在歌曲目录和最近投稿之间直接展示图片与日期范围，不跳转到动态页面。

同时获取最新四条投稿，写入 `public/videos.json`，在首页纵向展示封面、标题、日期、时长与播放量。周表的 `publishedAt`、`weekStart`、`weekEnd`、`weekLabel` 和本地图片路径保存在 `public/config.json`。

两个接口都使用带时间戳参数的六次缓慢重试，间隔逐次增加。没有周表、周表仍是同一条、动态更旧、接口报错或封面下载失败时，不覆盖当前周表配置或图片；视频失败时同样保留旧列表。Actions 只把最新结果带入部署产物，不会每天向仓库提交一次配置变更；本地需要同步时手动运行 `npm run update:schedule`。

## 本地缓存与更新

生产版本通过 `site/public/sw.js` 注册 Service Worker。主播图片、周表、歌曲封面和歌曲数据在构建时附加内容版本号，与 Vite 生成的哈希 JS/CSS 一起使用缓存优先策略；内容变化会生成新地址，不需要用户手动清理缓存。

入口页面、站点配置和视频数据使用网络优先策略，网络失败时回退到已有缓存。`npm run build` 同时生成 `dist/sw-manifest.js`，不要手动修改。开发服务器不注册 Service Worker，避免旧缓存影响开发。

## GitHub Pages 部署

工作流位于 `.github/workflows/deploy.yml`，在以下情况运行：

- 推送到 `main` 分支；
- 每天 09:17（北京时间）；
- 在 Actions 页面手动触发。

首次推送后，在仓库 **Settings → Pages → Build and deployment** 中将 Source 设为 **GitHub Actions**。工作流使用官方 `configure-pages`、`upload-pages-artifact` 和 `deploy-pages`，不需要第三方部署密钥。

`site/public/CNAME` 当前为 `www.wckrr.com`。沿用该域名时保留文件并确认 DNS 指向 GitHub Pages；换域名时修改它，不需要自定义域名时删除它。

## 本地 Git 配置

当前仓库使用 `LuckyKeroro <luckykeroro@126.com>` 作为提交作者与提交者，配置写入当前仓库的 `.git/config`，不影响全局 Git 或其他仓库。

`AGENTS.md` 是仅保留在本地的协作约定，不纳入远程仓库；`.gitignore` 中保留 `/AGENTS.md` 条目。推送前可用 `git ls-files` 确认它没有被跟踪。

## 目录与数据

```text
├── admin/               # 本地 Express 管理工具
│   ├── public/          # 管理端页面
│   ├── aliases.js       # 歌手标准名映射
│   └── server.js        # 本地 API 与预览服务
├── site/                # React + Vite 前台
│   ├── src/             # 页面、组件、搜索与样式
│   └── public/          # favicon、指针、CNAME 及构建时生成的数据
├── scripts/
│   ├── generate.js      # 歌曲聚合、图片压缩与 Vite 构建
│   └── update-schedule.js
├── Resources/           # 歌曲源数据与原始封面
├── public/              # 源配置、主播图片、周表图片与视频回退数据
└── dist/                # 构建产物，不提交
```

每首歌曲保存在 `Resources/歌手/专辑/歌名.json` 中，主要字段为 `title`、`artist`、`album`、`releaseDate`、`lyrics`、`language`、`cover`、`sourceUrl`。`Resources/` 和 `public/config.json` 是这个个人站点的源数据，应提交到用于部署的仓库并另外备份。`public/schedule.webp` 与 `public/videos.json` 也应提交，供接口失败时回退。

不要手动修改 `site/public/songs.json`、`site/public/videos.json`、`site/public/schedule.webp`、`site/public/covers/` 或 `dist/`；它们由 `npm run build` 重建。歌曲封面按源路径生成唯一 WebP 文件名，避免同名歌曲互相覆盖。

## 版权与说明

代码采用 [MIT License](LICENSE)。主播形象、青蛙布偶图标与插画权利归相应权利人所有，歌曲元数据来自公开网络。本项目仅用于粉丝查询，不提供音频播放或下载；如需删改，请联系维护者，请勿打扰主播。
