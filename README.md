# 磨耳朵 - 开源免费跨平台定时音频播放软件

## 项目简介

磨耳朵是一个基于 Tauri 框架开发的跨平台桌面应用程序，提供灵活的定时音频播放功能。通过定时播放用户自定义的音频内容，适用于多种场景：

- **个人闹钟** - 设置定时播放音乐、语音提醒等
- **语言学习** - 家长为孩子设置定时播放外语音频来"磨耳朵"，帮助记忆和培养语感
- **知识学习** - 定时播放课程、有声读物、学习材料等
- **习惯养成** - 通过定时音频提醒帮助建立良好的作息习惯

## Web 版本（Vercel）

本仓库同时提供一个可部署到 Vercel 的 Web 版本：

- ✅ 新概念英语（NCE1~4）在线播放（基于浏览器音频播放）
- ✅ 播放队列（点击课程自动生成队列）
- ✅ 在线音视频嵌入播放（YouTube / Bilibili）
- ✅ 移动端优化（iPad/iPhone/Safari/微信内置浏览器）

说明：Web 版本不包含桌面版的 SQLite/定时任务/音频提取等能力（这些依赖 Tauri/Rust 运行时）。

### Web 版本的页面与交互（儿童模式）

Web 版默认进入“视频乐园”页面（路由：`/online`），按 5 岁儿童点击即用的思路做了交互与样式：

- 横屏（iPad）为左右布局：左侧“视频合集列表”，右侧“播放器”
- 左侧列表支持滚动条与触屏滑动（含 iOS 的惯性滚动）
- 每个合集在本行内都提供：`- / 第xxx集 / + / 播放`，无需先选中再到顶部找按钮
- 点击“第001集”会弹出“选集列表”（窄面板，单列数字，可滚动），适合 100+ 集的合集快速跳转
- 右侧播放器支持“本页放大（剧场模式）”与“全屏”（不跳转到外部页面）
- 页面整体高度约束在横屏可视范围内：容器内容超出则在局部滚动，而不是让用户上下找按钮

> 版本号会显示在页面顶部（形如 `v6685bec`），用于确认 Vercel/Cloudflare 是否已刷新到最新构建。

### Web 版本数据源

默认从 `https://www.linktime.link` 读取新概念资源：

- `static/data.json`
- `NCE1~NCE4/*.mp3`
- `NCE1~NCE4/*.lrc`（存在则显示并滚动高亮）

可通过环境变量覆盖：

```bash
VITE_NCE_BASE_URL=https://www.linktime.link
```

### 部署到 Vercel

仓库已包含 `vercel.json`（自动使用 `npm run build` 并输出 `dist/`，同时配置 SPA 路由重写）。

在 Vercel 项目中建议设置：

- Build Command：`npm run build`
- Output Directory：`dist`
- Environment Variables：`VITE_NCE_BASE_URL=https://www.linktime.link`（可选）

### 配置 Bilibili“合集”（嵌入播放）

Web 版的“视频合集”来自配置文件：`public/presets/bilibili-series.json`。

每个条目最少需要：

- `title`：展示标题（中文）
- `bvid`：B 站 BV 号
- `pages`：集数（对应 `p=1..pages`）

建议：

- `title` 尽量短（例如“儿童百科”），避免在 iPad/微信内置浏览器里把一行布局挤变形
- 合集顺序就是页面显示顺序：把条目移动到数组更靠前的位置即可“置顶”

示例（最简）：

```json
[
  {
    "title": "数字积木（120集，分50P）",
    "bvid": "BV1GQ6iBREbH",
    "pages": 50
  }
]
```

#### 为什么有时“选哪一集都播放第 1 集”

部分 B 站视频的每一集（`p`）对应不同的 `cid`。如果只拼 `bvid + p`，某些情况下播放器会回落到第 1 集。

解决方法：在该条目里补充 `aid` 和 `cids`（每一集对应一个 `cid`，长度应等于 `pages`）。来源一般就是你复制的 iframe 代码中的参数：

```html
<iframe
  src="//player.bilibili.com/player.html?isOutside=true&aid=...&bvid=...&cid=...&p=1"
></iframe>
```

配置示例（截断演示）：

```json
[
  {
    "title": "数字积木（120集，分50P）",
    "bvid": "BV1GQ6iBREbH",
    "aid": 123456789,
    "pages": 50,
    "cids": [111, 222, 333]
  }
]
```

#### 快速获取 `aid / pages / cids`（推荐）

在 Windows PowerShell 里执行（把 BV 号替换成你的）：

```powershell
$bvid = "BV1otzcB8EF4"
$j = (curl.exe -s "https://api.bilibili.com/x/web-interface/view?bvid=$bvid" | ConvertFrom-Json)
$aid = $j.data.aid
$pages = $j.data.pages.Count
$cids = @($j.data.pages | Sort-Object page | ForEach-Object { [int64]$_.cid })

"aid=$aid"
"pages=$pages"
$cids -join ","
```

拿到的 `aid/pages/cids` 直接填回 `public/presets/bilibili-series.json` 对应条目即可。

### 播放记录（自动续播）

Web 版会把“每个合集上次播放到第几集”写入浏览器 Cookie（同一域名下生效）：

- 同一设备：下次打开继续从上次的集数开始
- 换设备/换浏览器：是全新的播放记录（不会跨设备同步）

### 拼音（带声调）与字体

“视频合集”会显示一行拼音提示，便于孩子识别（例如：`shù zì jī mù`）。

- 拼音提示的映射逻辑在：`src/web/pages/OnlineEmbedPage.tsx`（`makePinyinTip`）
- 拼音会做统一规范化展示：把 `a/ā/á/ǎ/à` 规范成 `ɑ̄ ɑ́ ɑ̌ ɑ̀`（避免 iPad 上出现“看起来像希腊字母的 a”）
- 拼音使用内置字体 `PinyinKid`（文件在 `public/fonts/`，样式在 `src/index.css` 的 `.pinyin-text`）
- “上一集 / 下一集”等按钮也带拼音（同一字体与规范化规则）

### 缓存与“我明明推送了但页面没变”

如果你在无痕模式/不同设备仍然看到旧样式，通常是 CDN 缓存导致（Cloudflare / Vercel）：

1. 先看页面顶部版本号（`vxxxxxxx`）是否已变化
2. 若版本号没变：等待 Vercel 部署完成，或检查部署项目是否指向正确分支
3. 若版本号已变但样式没变：在 Cloudflare 清除缓存（可按“主机名”或“前缀”清除），再强制刷新

## 应用截图

### 功能介绍
![功能介绍](screenshot/功能介绍.jpg)

### 音频库管理
![本地视频提取音频](screenshot/本地视频提取音频.jpg)
![在线视频提取音频](screenshot/在线视频提取音频.jpg)
![直接录制音频](screenshot/直接录制音频.jpg)

### 播放控制
![直接播放音频](screenshot/直接播放音频.jpg)

### 播放列表
![播放列表](screenshot/播放列表.jpg)

### 定时任务
![定时任务设置](screenshot/定时任务设置.jpg)

## 核心功能

### 音频文件管理
- 支持多种音频格式（MP3、WAV、OGG、FLAC、M4A）
- 在线视频音频提取（支持 YouTube、Bilibili 等主流平台）
- 本地视频音频提取
- 直接录制音频
- 文件搜索和批量管理
- 在线测试播放
- 自动识别文件大小和时长

### 播放列表管理
- 创建多个播放列表
- 灵活的播放模式：
  - 顺序播放
  - 随机播放
  - 单曲循环
  - 列表循环

### 定时任务系统
- 精确的时间控制（时:分）
- 多样的重复模式：
  - 每天
  - 工作日（周一至周五）
  - 周末（周六、周日）
  - 自定义星期选择
  - 仅一次
- 音量独立控制
- 渐强播放设置（0-300秒）
- 任务启用/禁用开关

### 音频播放
- 基于 Rodio 的高质量播放引擎
- 播放/暂停/停止控制
- 实时音量调节
- 多格式音频支持

## 待开发功能

- [ ] 播放列表拖拽排序
- [ ] 播放列表快速编辑
- [ ] 文字转语音（TTS）功能
- [ ] 文字生成播客内容(接入外部供应商)
- [ ] 自动汇总最近热点并语音播放(接入外部供应商)
- [ ] Android 客户端
- [ ] iOS 客户端

## 技术栈

### 前端
- React 18 + TypeScript
- Tailwind CSS（样式）
- Zustand（状态管理）
- Lucide React（图标）
- Vite（构建工具）

### 后端
- Tauri 1.5（桌面应用框架）
- Rust（后端语言）
- SQLite（本地数据库）
- Rodio（音频播放）
- Tokio（异步运行时）

## 安装与使用

### 前置要求
- Node.js 18+
- npm 10+
- Rust 1.70+
- Cargo

### 安装依赖

```bash
# 进入项目目录
cd moerduo

# 安装 npm 依赖
npm install

# Cargo 依赖会在首次构建时自动下载
```

### 开发模式运行

```bash
npm run dev:web          # Web 版本开发（Vite）
npm run dev:tauri        # 桌面版开发（Tauri）
```

### 构建生产版本

```bash
npm run build            # 构建 Web 版本（Vercel 使用）
npm run build:tauri      # 构建桌面版（Tauri）
```

## 项目结构

```
moerduo/
├── src/                      # 前端源代码
│   ├── pages/               # 页面组件
│   │   ├── AudioLibrary.tsx # 音频库管理
│   │   ├── Playlists.tsx    # 播放列表管理
│   │   ├── Tasks.tsx        # 定时任务管理
│   │   ├── Statistics.tsx   # 使用统计
│   │   ├── Settings.tsx     # 应用设置
│   │   └── Help.tsx         # 帮助文档
│   ├── components/          # 可复用组件
│   ├── contexts/            # React 上下文
│   ├── hooks/               # 自定义 Hooks
│   ├── App.tsx              # 主应用组件
│   └── main.tsx             # 入口文件
├── src/web/                  # Web 版本（新概念播放器 + 队列 + 在线嵌入）
├── src-tauri/               # 后端源代码
│   └── src/
│       ├── main.rs          # 程序入口
│       ├── db.rs            # 数据库初始化
│       ├── audio.rs         # 音频文件管理
│       ├── player.rs        # 音频播放引擎
│       ├── playlist.rs      # 播放列表管理
│       ├── task.rs          # 定时任务管理
│       ├── scheduler.rs     # 任务调度器
│       ├── stats.rs         # 统计功能
│       └── settings.rs      # 设置管理
├── tools/                   # 内置工具（FFmpeg、yt-dlp）
├── screenshot/              # 应用截图
├── package.json             # 前端依赖配置
├── Cargo.toml               # 后端依赖配置
├── vercel.json              # Vercel 配置（Web 版本）
└── README.md                # 本文件
```

## 数据存储

应用使用 SQLite 数据库存储所有数据，包括：

- **audio_files** - 音频文件元数据和播放统计
- **playlists** - 播放列表配置
- **playlist_items** - 播放列表与音频文件的关联
- **scheduled_tasks** - 定时任务配置
- **execution_history** - 任务执行历史记录
- **app_settings** - 应用设置

音频文件存储在应用数据目录的 `audio/` 文件夹中，使用 UUID 命名以避免文件名冲突。

## 在线视频音频提取

应用内置 FFmpeg 和 yt-dlp 工具，支持从以下平台提取音频：

- YouTube
- Bilibili
- 其他主流视频平台

**注意：** 工具文件（`tools/` 目录）不包含在 Git 仓库中。首次构建时，应用会自动下载并安装所需工具。

## 常见问题

### 如何添加音频文件？
1. 进入"音频库"页面
2. 点击"上传音频"按钮选择本地文件
3. 或点击"在线视频"按钮输入视频链接提取音频
4. 或点击"录制音频"按钮直接录制

### 如何创建定时任务？
1. 进入"定时任务"页面
2. 点击"新建任务"
3. 设置触发时间、重复模式、播放列表和音量
4. 保存并启用任务

### 如何自定义播放模式？
在"播放列表"页面，每个列表都可以独立设置播放模式（顺序/随机/单曲循环/列表循环）。

## 贡献指南

欢迎贡献代码、报告问题或提出建议！

1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

## 许可证

本项目采用 [MIT License](LICENSE) 开源协议。
