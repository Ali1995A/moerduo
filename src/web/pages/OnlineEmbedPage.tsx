import { useEffect, useMemo, useRef, useState } from 'react'
import { loadPresetSeries, loadPresetVideos, type PresetSeries, type PresetVideo } from '../online/presets'

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

function buildEmbed(url: string): { provider: 'youtube' | 'bilibili'; embedUrl: string } | null {
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
  if (normalized.includes('数字积木')) return 'shù zì jī mù'
  if (normalized.includes('数字方块')) return 'shù zì fāng kuài'
  if (normalized.includes('数字对比')) return 'shù zì duì bǐ'
  if (normalized.includes('地理大百科')) return 'dì lǐ dà bǎi kē'
  if (normalized.includes('彼得兔')) return 'bǐ dé tù'
  if (normalized.includes('小学数学')) return 'xiǎo xué shù xué'
  if (normalized.includes('小学英语')) return 'xiǎo xué yīng yǔ'
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
  const [, setPresets] = useState<PresetVideo[]>([])
  const [series, setSeries] = useState<PresetSeries[]>([])
  const [episodeByBvid, setEpisodeByBvid] = useState<Record<string, number>>({})
  const [selectedBvid, setSelectedBvid] = useState<string | null>(null)
  const [nowPlaying, setNowPlaying] = useState<{
    title: string
    bvid: string
    page: number
    pages: number
  } | null>(null)
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
    if (rawSelected) setSelectedBvid(rawSelected)
  }, [])

  useEffect(() => {
    let canceled = false
    loadPresetVideos().then((v) => {
      if (canceled) return
      setPresets(v)
    })
    loadPresetSeries().then((s) => {
      if (canceled) return
      setSeries(s)
      setSelectedBvid((prev) => prev ?? (s[0]?.bvid ?? null))
      setEpisodeByBvid((prev) => {
        const next = { ...prev }
        for (const item of s) {
          if (next[item.bvid] == null) next[item.bvid] = 1
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
    if (!selectedBvid) return
    writeCookie(COOKIE_SELECTED, selectedBvid, 60 * 60 * 24 * 365)
  }, [selectedBvid])

  const normalizedInput = useMemo(() => normalizeUrl(input), [input])
  const embed = useMemo(() => buildEmbed(normalizedInput), [normalizedInput])

  function clampEpisode(page: number, pages: number): number {
    const max = Math.max(1, Math.floor(pages))
    const p = Math.floor(page)
    if (!Number.isFinite(p)) return 1
    return Math.max(1, Math.min(max, p))
  }

  function getEpisode(bvid: string): number {
    return episodeByBvid[bvid] ?? 1
  }

  function setEpisode(bvid: string, page: number, pages: number) {
    const nextPage = clampEpisode(page, pages)
    setEpisodeByBvid((prev) => ({ ...prev, [bvid]: nextPage }))
  }

  function buildBilibiliSeriesUrl(s: PresetSeries, page: number): string {
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
    setInput(buildBilibiliSeriesUrl(s, page))
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
                  const page = getEpisode(s.bvid)
                  const padded = String(page).padStart(3, '0')
                  const selected = selectedBvid === s.bvid
                  const pinyin = makePinyinTip(s.title)
                  return (
                    <div
                      key={s.bvid}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedBvid(s.bvid)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') setSelectedBvid(s.bvid)
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
                            setSelectedBvid(s.bvid)
                            setEpisode(s.bvid, page - 1, s.pages)
                          }}
                          className="kid-focus kid-btn kid-btn-soft w-12 rounded-2xl text-lg font-extrabold text-gray-800"
                          aria-label="上一集"
                        >
                          −
                        </button>

                        <div className="kid-card kid-pill px-4 py-2 text-sm font-extrabold text-gray-800">第 {padded} 集</div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedBvid(s.bvid)
                            setEpisode(s.bvid, page + 1, s.pages)
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
                            const p = clampEpisode(getEpisode(s.bvid), s.pages)
                            setSelectedBvid(s.bvid)
                            playSeriesEpisode(s, p)
                            setNowPlaying({ title: s.title, bvid: s.bvid, page: p, pages: s.pages })
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
              'kid-card flex h-full min-h-0 flex-col p-3',
              isTheater ? 'fixed inset-0 z-50 m-0 rounded-none p-4 pt-6 bg-white/95 backdrop-blur' : '',
            ].join(' ')}
          >
            {!input.trim() ? (
              <div className="rounded-2xl border border-dashed border-pink-100 bg-white/60 p-6 text-sm font-semibold text-gray-600">
                点一个合集的“播放”，就会在这里出现播放器～
              </div>
            ) : !embed ? (
              <div className="rounded-2xl border border-dashed border-pink-100 bg-white/60 p-6 text-sm font-semibold text-gray-600">
                这个链接我不认识～请确认是 YouTube 或 Bilibili 的分享链接。
              </div>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="text-xs font-extrabold text-gray-700">{isTheater ? '大窗口播放' : '播放窗口'}</div>
                  <div className="flex items-center gap-2">
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

                {nowPlaying ? (
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
                            setEpisode(nowPlaying.bvid, prev, nowPlaying.pages)
                            const s = series.find((x) => x.bvid === nowPlaying.bvid)
                            if (s) playSeriesEpisode(s, prev)
                            setNowPlaying({ ...nowPlaying, page: prev })
                            scrollToPlayer()
                          }}
                        disabled={nowPlaying.page <= 1}
                        className="kid-focus kid-btn kid-btn-soft flex-1 rounded-2xl px-4 text-sm font-extrabold text-gray-800 disabled:opacity-50"
                      >
                        上一集
                      </button>
                      <button
                        type="button"
                          onClick={() => {
                            const next = clampEpisode(nowPlaying.page + 1, nowPlaying.pages)
                            setEpisode(nowPlaying.bvid, next, nowPlaying.pages)
                            const s = series.find((x) => x.bvid === nowPlaying.bvid)
                            if (s) playSeriesEpisode(s, next)
                            setNowPlaying({ ...nowPlaying, page: next })
                            scrollToPlayer()
                          }}
                        disabled={nowPlaying.page >= nowPlaying.pages}
                        className="kid-focus kid-btn kid-btn-primary flex-1 rounded-2xl px-4 text-sm font-extrabold text-white disabled:opacity-50"
                      >
                        下一集
                      </button>
                    </div>
                  </div>
                ) : null}

                <div ref={playerBoxRef} className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-pink-100 bg-black">
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
