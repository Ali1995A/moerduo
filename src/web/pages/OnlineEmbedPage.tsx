import { useEffect, useMemo, useRef, useState } from 'react'
import { loadPresetSeries, type PresetSeries } from '../online/presets'

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[$()*+./?[\\\]^{|}-]/g, '\\\\$&')}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function writeCookie(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`
}

const COOKIE_EPISODES = 'moerduo_bili_episodes'
const COOKIE_SELECTED = 'moerduo_bili_selected'

function extractIframeSrc(input: string): string | null {
  const match = input.match(/<iframe[^>]*\s+src=(["'])(.*?)\1/i)
  return match?.[2] ?? null
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''

  const iframeSrc = extractIframeSrc(trimmed)
  const candidate = iframeSrc ?? trimmed

  if (candidate.startsWith('//')) return `https:${candidate}`
  return candidate
}

function getYouTubeId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') return u.pathname.replace('/', '') || null
    if (u.hostname.endsWith('youtube.com')) {
      const v = u.searchParams.get('v')
      if (v) return v
      const match = u.pathname.match(/\/shorts\/([^/]+)/) || u.pathname.match(/\/embed\/([^/]+)/)
      return match?.[1] ?? null
    }
  } catch {
    return null
  }
  return null
}

function getBilibiliBvid(url: string): string | null {
  try {
    const u = new URL(url)
    if (!u.hostname.endsWith('bilibili.com')) return null
    const match = u.pathname.match(/\/video\/(BV[0-9A-Za-z]+)/)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

function getBilibiliEmbed(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname !== 'player.bilibili.com') return null
    if (!u.pathname.endsWith('/player.html')) return null
    // Keep original query params (including aid/cid/p) to ensure correct episode selection.
    const qp = u.searchParams
    if (!qp.get('isOutside')) qp.set('isOutside', 'true')
    if (!qp.get('high_quality')) qp.set('high_quality', '1')
    if (!qp.get('danmaku')) qp.set('danmaku', '0')
    if (!qp.get('autoplay')) qp.set('autoplay', '0')
    return `https://player.bilibili.com/player.html?${qp.toString()}`
  } catch {
    return null
  }
}

function getIqiyiEmbed(url: string): string | null {
  try {
    const u = new URL(url)
    if (!u.hostname.endsWith('iqiyi.com')) return null
    // iqiyi pages may block iframe embedding, but we still try; UI also provides "open original" button.
    return u.toString()
  } catch {
    return null
  }
}

function buildEmbed(url: string): { provider: 'youtube' | 'bilibili' | 'iqiyi'; embedUrl: string } | null {
  const yt = getYouTubeId(url)
  if (yt) {
    return {
      provider: 'youtube',
      embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(yt)}?autoplay=0&playsinline=1`,
    }
  }

  const bilibiliEmbed = getBilibiliEmbed(url)
  if (bilibiliEmbed) {
    return { provider: 'bilibili', embedUrl: bilibiliEmbed }
  }

  const iqiyiEmbed = getIqiyiEmbed(url)
  if (iqiyiEmbed) {
    return { provider: 'iqiyi', embedUrl: iqiyiEmbed }
  }

  const bv = getBilibiliBvid(url)
  if (bv) {
    return {
      provider: 'bilibili',
      embedUrl: `https://player.bilibili.com/player.html?bvid=${encodeURIComponent(bv)}&p=1&high_quality=1&danmaku=0&autoplay=0&isOutside=true`,
    }
  }

  return null
}

function makePinyinTip(title: string): string | null {
  // Minimal built-in pinyin tips for the most common UI words.
  const normalized = title.replace(/\s+/g, '').toLowerCase()
  if (normalized.includes('奇妙萌可合集')) return 'qí miào méng kě hé jí'
  if (normalized.includes('奇妙萌可')) return 'qí miào méng kě'
  if (normalized.includes('蜡笔小新第10季') || normalized.includes('蜡笔小新第十季')) return 'là bǐ xiǎo xīn dì shí jì'
  if (normalized.includes('蜡笔小新第9季') || normalized.includes('蜡笔小新第九季')) return 'là bǐ xiǎo xīn dì jiǔ jì'
  if (normalized.includes('蜡笔小新第7季') || normalized.includes('蜡笔小新第七季')) return 'là bǐ xiǎo xīn dì qī jì'
  if (normalized.includes('蜡笔小新')) return 'là bǐ xiǎo xīn'
  if (normalized.includes('哆啦a梦') || normalized.includes('哆啦a夢')) return 'duō la a mèng'
  if (normalized.includes('哆啦a')) return 'duō la a'
  if (normalized.includes('哆啦')) return 'duō la'
  if (normalized.includes('猫和老鼠') || normalized.includes('汤姆与杰瑞')) return 'māo hé lǎo shǔ'
  if (normalized.includes('米老鼠和唐老鸭')) return 'mǐ lǎo shǔ hé táng lǎo yā'
  if (normalized.includes('米老鼠')) return 'mǐ lǎo shǔ'
  if (normalized.includes('唐老鸭')) return 'táng lǎo yā'
  if (normalized.includes('超级马里奥合集')) return 'chāo jí mǎ lǐ ào hé jí'
  if (normalized.includes('马里奥兄弟')) return 'mǎ lǐ ào xiōng dì'
  if (normalized.includes('超级马里奥')) return 'chāo jí mǎ lǐ ào'
  if (normalized.includes('马里奥')) return 'mǎ lǐ ào'
  if (normalized.includes('数字积木第6季') || normalized.includes('数字积木第六季')) return 'shù zì jī mù dì liù jì'
  if (normalized.includes('数字积木第7季') || normalized.includes('数字积木第七季')) return 'shù zì jī mù dì qī jì'
  if (normalized.includes('数字积木第8季') || normalized.includes('数字积木第八季')) return 'shù zì jī mù dì bā jì'
  if (normalized.includes('数字积木')) return 'shù zì jī mù'
  if (normalized.includes('数字方块')) return 'shù zì fāng kuài'
  if (normalized.includes('数字对比')) return 'shù zì duì bǐ'
  if (normalized.includes('地理大百科')) return 'dì lǐ dà bǎi kē'
  if (normalized.includes('彼得兔')) return 'bǐ dé tù'
  if (normalized.includes('小学数学')) return 'xiǎo xué shù xué'
  if (normalized.includes('小学英语')) return 'xiǎo xué yīng yǔ'
  if (normalized.includes('儿童百科') || normalized.includes('科普动画')) return 'ér tóng bǎi kē kē pǔ'
  if (normalized.includes('物理')) return 'wù lǐ'
  if (normalized.includes('上下五千年')) return 'shàng xià wǔ qiān nián'
  if (normalized.includes('新概念')) return 'xīn gài niàn'
  return null
}

function normalizePinyinForDisplay(input: string): string {
  // Render "a" as IPA open a (ɑ) with combining tone marks, e.g. ɑ̄ ɑ́ ɑ̌ ɑ̀.
  // This keeps the visual style consistent on iPad/WeChat and matches the desired output.
  return input
    .replace(/ā/g, 'ɑ\u0304')
    .replace(/á/g, 'ɑ\u0301')
    .replace(/ǎ/g, 'ɑ\u030C')
    .replace(/à/g, 'ɑ\u0300')
    .replace(/a/g, 'ɑ')
}

export default function OnlineEmbedPage() {
  const [input, setInput] = useState('')
  const [series, setSeries] = useState<PresetSeries[]>([])
  const [episodeByBvid, setEpisodeByBvid] = useState<Record<string, number>>({})
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null)
  const [episodePickerSeriesId, setEpisodePickerSeriesId] = useState<string | null>(null)
  const pickerPanelRef = useRef<HTMLDivElement | null>(null)
  const pickerButtonRef = useRef<HTMLButtonElement | null>(null)
  const [nowPlaying, setNowPlaying] = useState<
    | { kind: 'series'; title: string; seriesId: string; page: number; pages: number }
    | { kind: 'video'; title: string }
    | null
  >(null)
  const playerRef = useRef<HTMLDivElement | null>(null)
  const playerBoxRef = useRef<HTMLDivElement | null>(null)
  const [isTheater, setIsTheater] = useState(false)

  useEffect(() => {
    const rawEpisodes = readCookie(COOKIE_EPISODES)
    if (rawEpisodes) {
      try {
        const parsed = JSON.parse(rawEpisodes) as unknown
        if (parsed && typeof parsed === 'object') {
          const next: Record<string, number> = {}
          for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
            if (typeof k !== 'string') continue
            const n = typeof v === 'number' ? v : Number(v)
            if (Number.isFinite(n) && n > 0) next[k] = Math.floor(n)
          }
          setEpisodeByBvid(next)
        }
      } catch {
        // ignore
      }
    }
    const rawSelected = readCookie(COOKIE_SELECTED)
    if (rawSelected) setSelectedSeriesId(rawSelected)
  }, [])

  useEffect(() => {
    if (!episodePickerSeriesId) return

    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node | null
      if (!t) return
      if (pickerPanelRef.current?.contains(t)) return
      if (pickerButtonRef.current?.contains(t)) return
      setEpisodePickerSeriesId(null)
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [episodePickerSeriesId])

  useEffect(() => {
    let canceled = false
    loadPresetSeries().then((s) => {
      if (canceled) return
      setSeries(s)
      setSelectedSeriesId((prev) => prev ?? (s[0]?.id ?? null))
      setEpisodeByBvid((prev) => {
        const next = { ...prev }
        for (const item of s) {
          if (next[item.id] == null) next[item.id] = 1
        }
        return next
      })
    })
    return () => {
      canceled = true
    }
  }, [])

  useEffect(() => {
    writeCookie(COOKIE_EPISODES, JSON.stringify(episodeByBvid), 60 * 60 * 24 * 365)
  }, [episodeByBvid])

  useEffect(() => {
    if (!selectedSeriesId) return
    writeCookie(COOKIE_SELECTED, selectedSeriesId, 60 * 60 * 24 * 365)
  }, [selectedSeriesId])

  const normalizedInput = useMemo(() => normalizeUrl(input), [input])
  const embed = useMemo(() => buildEmbed(normalizedInput), [normalizedInput])

  function clampEpisode(page: number, pages: number): number {
    const max = Math.max(1, Math.floor(pages))
    const p = Math.floor(page)
    if (!Number.isFinite(p)) return 1
    return Math.max(1, Math.min(max, p))
  }

  function getEpisode(seriesId: string): number {
    return episodeByBvid[seriesId] ?? 1
  }

  function setEpisode(seriesId: string, page: number, pages: number) {
    const nextPage = clampEpisode(page, pages)
    setEpisodeByBvid((prev) => ({ ...prev, [seriesId]: nextPage }))
  }

  function buildBilibiliSeriesUrl(s: PresetSeries, page: number): string {
    if (s.kind !== 'bilibili' || !s.bvid) return ''
    const p = Math.max(1, Math.floor(page))
    const cid = s.cids?.[p - 1]
    const aid = s.aid
    const params = new URLSearchParams()
    params.set('isOutside', 'true')
    params.set('high_quality', '1')
    params.set('danmaku', '0')
    params.set('autoplay', '0')
    params.set('bvid', s.bvid)
    params.set('p', String(p))
    if (aid) params.set('aid', String(aid))
    if (cid) params.set('cid', String(cid))
    return `https://player.bilibili.com/player.html?${params.toString()}`
  }

  function playSeriesEpisode(s: PresetSeries, page: number) {
    if (s.kind === 'custom') {
      const p = clampEpisode(page, s.pages)
      const url = s.items?.[p - 1]?.url
      if (url) setInput(url)
      return
    }

    const url = buildBilibiliSeriesUrl(s, page)
    if (url) setInput(url)
  }

  function scrollToPlayer() {
    const el = playerRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function requestPlayerFullscreen() {
    const el = playerBoxRef.current
    if (!el) return
    const anyEl = el as any
    const req =
      el.requestFullscreen ||
      anyEl.webkitRequestFullscreen ||
      anyEl.webkitRequestFullScreen ||
      anyEl.mozRequestFullScreen ||
      anyEl.msRequestFullscreen
    if (typeof req === 'function') {
      try {
        req.call(el)
      } catch {
        // ignore
      }
    }
  }

  return (
    <main className="w-full p-4 pb-[calc(env(safe-area-inset-bottom)+12px)] md:h-[calc(100dvh-72px)] md:overflow-hidden md:pb-4">
      <div className="grid min-h-0 gap-4 md:h-full md:grid-cols-[0.7fr_1.3fr]">
        <section className="kid-scroll min-h-0">
          <div className="kid-card p-4">
            <div className="text-sm font-extrabold text-gray-900">视频乐园</div>
            <div className="mt-1 text-xs font-semibold text-gray-600">点一个合集的“播放”，就能在右边看视频。</div>

            <div className="mt-4 kid-card p-4">
              <div className="text-sm font-extrabold text-gray-900">视频合集</div>
              <div className="mt-1 text-xs font-semibold text-gray-600">每个合集一行：选第几集，然后点“播放”。</div>

              <div className="mt-3 flex flex-col gap-2">
                {series.map((s) => {
                  const page = getEpisode(s.id)
                  const padded = String(page).padStart(3, '0')
                  const selected = selectedSeriesId === s.id
                  const pinyin = makePinyinTip(s.title)
                  const pickerOpen = episodePickerSeriesId === s.id
                  return (
                    <div
                      key={s.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedSeriesId(s.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') setSelectedSeriesId(s.id)
                      }}
                      className={[
                        'kid-focus kid-card flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between cursor-pointer',
                        selected ? 'bg-pink-50' : '',
                      ].join(' ')}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-extrabold text-gray-900">{s.title}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-gray-500">
                          <span>{s.pages} 集</span>
                          {pinyin ? (
                            <span className="pinyin-text rounded-full bg-pink-50 px-2 py-0.5 font-bold text-pink-700">
                              {normalizePinyinForDisplay(pinyin)}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedSeriesId(s.id)
                            setEpisode(s.id, page - 1, s.pages)
                          }}
                          className="kid-focus kid-btn kid-btn-soft w-12 rounded-2xl text-lg font-extrabold text-gray-800"
                          aria-label="上一集"
                        >
                          −
                        </button>

                        <div className="relative">
                          <button
                            ref={pickerOpen ? pickerButtonRef : undefined}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedSeriesId(s.id)
                              setEpisodePickerSeriesId((cur) => (cur === s.id ? null : s.id))
                            }}
                            className="kid-focus kid-card kid-pill px-4 py-2 text-sm font-extrabold text-gray-800"
                            aria-label={`选择集数：当前第 ${padded} 集`}
                          >
                            第 {padded} 集
                          </button>

                          {pickerOpen ? (
                            <div
                              ref={pickerPanelRef}
                              role="dialog"
                              aria-label="选择集数"
                              className="kid-card absolute left-0 top-[calc(100%+8px)] z-20 w-40 max-w-[calc(100vw-64px)] p-3"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-extrabold text-gray-900">选集</div>
                                <button
                                  type="button"
                                  className="kid-focus kid-btn kid-btn-soft w-10 rounded-2xl text-lg font-extrabold text-gray-800"
                                  onClick={() => setEpisodePickerSeriesId(null)}
                                  aria-label="关闭"
                                >
                                  ×
                                </button>
                              </div>

                              <div className="mt-2 text-xs font-semibold text-gray-600">
                                当前 {padded} / 共 {String(s.pages).padStart(3, '0')}
                              </div>

                              <div className="kid-scroll mt-2 max-h-72 rounded-2xl border border-pink-100 bg-white/70 p-2">
                                <div className="flex flex-col gap-2">
                                  {Array.from({ length: s.pages }, (_, i) => i + 1).map((n) => {
                                    const active = n === page
                                    return (
                                      <button
                                        key={n}
                                        type="button"
                                        className={[
                                          'kid-focus kid-btn kid-btn-soft w-full rounded-2xl px-0 py-2 text-sm font-extrabold',
                                          active ? 'bg-pink-50 text-pink-700' : 'text-gray-800',
                                        ].join(' ')}
                                        onClick={() => {
                                          setEpisode(s.id, n, s.pages)
                                          setEpisodePickerSeriesId(null)
                                        }}
                                      >
                                        {String(n).padStart(3, '0')}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedSeriesId(s.id)
                            setEpisode(s.id, page + 1, s.pages)
                          }}
                          className="kid-focus kid-btn kid-btn-soft w-12 rounded-2xl text-lg font-extrabold text-gray-800"
                          aria-label="下一集"
                        >
                          +
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            const p = clampEpisode(getEpisode(s.id), s.pages)
                            setSelectedSeriesId(s.id)
                            playSeriesEpisode(s, p)
                            setNowPlaying({ kind: 'series', title: s.title, seriesId: s.id, page: p, pages: s.pages })
                            scrollToPlayer()
                          }}
                          className="kid-focus kid-btn kid-btn-primary rounded-2xl px-5 text-sm font-extrabold text-white"
                        >
                          播放
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="mt-4 kid-card p-4">
              <div className="text-sm font-extrabold text-gray-900">粘贴链接</div>
              <div className="mt-1 text-xs font-semibold text-gray-600">也可以自己粘贴一个链接（B站/YouTube）。</div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value)
                    setNowPlaying(null)
                  }}
                  placeholder="粘贴链接"
                  className="kid-focus h-12 w-full rounded-3xl border border-pink-100 bg-white/80 px-4 text-sm font-semibold outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-pink-100"
                  inputMode="url"
                />
                <button
                  type="button"
                  onClick={() => {
                    setInput('')
                    setNowPlaying(null)
                  }}
                  className="kid-focus kid-btn kid-btn-soft rounded-3xl px-5 text-sm font-extrabold text-gray-700 hover:bg-white"
                >
                  清空
                </button>
              </div>
            </div>
          </div>
        </section>

        <section ref={playerRef} className="min-h-0 md:h-full">
          <div
            className={[
              'kid-card flex min-h-0 flex-col p-3 md:h-full',
              isTheater ? 'fixed inset-0 z-50 m-0 rounded-none p-4 pt-6 bg-white/95 backdrop-blur' : '',
            ].join(' ')}
          >
            {!input.trim() ? (
              <div className="rounded-2xl border border-dashed border-pink-100 bg-white/60 p-6 text-sm font-semibold text-gray-600">
                点一个合集的“播放”，就会在这里出现播放器～
              </div>
            ) : !embed ? (
              <div className="rounded-2xl border border-dashed border-pink-100 bg-white/60 p-6 text-sm font-semibold text-gray-600">
                这个链接我不认识～请确认是 YouTube / Bilibili / 爱奇艺 的分享链接。
              </div>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="text-xs font-extrabold text-gray-700">{isTheater ? '大窗口播放' : '播放窗口'}</div>
                  <div className="flex items-center gap-2">
                    {normalizedInput ? (
                      <a
                        href={normalizedInput}
                        target="_blank"
                        rel="noreferrer"
                        className="kid-focus kid-btn kid-btn-soft rounded-2xl px-4 text-sm font-extrabold text-gray-800"
                      >
                        打开原网页
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setIsTheater((v) => !v)}
                      className="kid-focus kid-btn kid-btn-soft rounded-2xl px-4 text-sm font-extrabold text-gray-800"
                    >
                      {isTheater ? '还原' : '放大'}
                    </button>
                    <button
                      type="button"
                      onClick={requestPlayerFullscreen}
                      className="kid-focus kid-btn kid-btn-primary rounded-2xl px-4 text-sm font-extrabold text-white"
                    >
                      全屏
                    </button>
                  </div>
                </div>

                {nowPlaying && nowPlaying.kind === 'series' ? (
                  <div className="mb-3 flex flex-col gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-extrabold text-gray-900">{nowPlaying.title}</div>
                      <div className="mt-0.5 text-xs font-semibold text-gray-600">
                        第 {String(nowPlaying.page).padStart(3, '0')} 集 / 共 {nowPlaying.pages} 集
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                          onClick={() => {
                            const prev = clampEpisode(nowPlaying.page - 1, nowPlaying.pages)
                            setEpisode(nowPlaying.seriesId, prev, nowPlaying.pages)
                            const s = series.find((x) => x.id === nowPlaying.seriesId)
                            if (s) playSeriesEpisode(s, prev)
                            setNowPlaying({ ...nowPlaying, page: prev })
                            scrollToPlayer()
                          }}
                        disabled={nowPlaying.page <= 1}
                        className="kid-focus kid-btn kid-btn-soft flex flex-1 flex-col items-center justify-center rounded-2xl px-4 py-2 text-sm font-extrabold text-gray-800 disabled:opacity-50"
                      >
                        <span>上一集</span>
                        <span className="pinyin-text mt-0.5 text-[11px] font-bold text-pink-600">
                          {normalizePinyinForDisplay('shàng yí jí')}
                        </span>
                      </button>
                      <button
                        type="button"
                          onClick={() => {
                            const next = clampEpisode(nowPlaying.page + 1, nowPlaying.pages)
                            setEpisode(nowPlaying.seriesId, next, nowPlaying.pages)
                            const s = series.find((x) => x.id === nowPlaying.seriesId)
                            if (s) playSeriesEpisode(s, next)
                            setNowPlaying({ ...nowPlaying, page: next })
                            scrollToPlayer()
                          }}
                        disabled={nowPlaying.page >= nowPlaying.pages}
                        className="kid-focus kid-btn kid-btn-primary flex flex-1 flex-col items-center justify-center rounded-2xl px-4 py-2 text-sm font-extrabold text-white disabled:opacity-50"
                      >
                        <span>下一集</span>
                        <span className="pinyin-text mt-0.5 text-[11px] font-bold text-white/90">
                          {normalizePinyinForDisplay('xià yí jí')}
                        </span>
                      </button>
                    </div>
                  </div>
                ) : nowPlaying && nowPlaying.kind === 'video' ? (
                  <div className="mb-3 flex flex-col gap-1">
                    <div className="truncate text-sm font-extrabold text-gray-900">{nowPlaying.title}</div>
                    {(() => {
                      const pinyin = makePinyinTip(nowPlaying.title)
                      return pinyin ? (
                        <div className="text-xs font-semibold text-gray-600">
                          <span className="pinyin-text rounded-full bg-pink-50 px-2 py-0.5 font-bold text-pink-700">
                            {normalizePinyinForDisplay(pinyin)}
                          </span>
                        </div>
                      ) : null
                    })()}
                  </div>
                ) : null}

                <div
                  ref={playerBoxRef}
                  className="h-[56vw] min-h-[220px] overflow-hidden rounded-2xl border border-pink-100 bg-black md:h-auto md:min-h-0 md:flex-1"
                >
                  <iframe
                    src={embed.embedUrl}
                    title="Online Player"
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    referrerPolicy="no-referrer"
                  />
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
