import { useEffect, useMemo, useRef, useState } from 'react'
import { loadPresetSeries, loadPresetVideos, type PresetSeries, type PresetVideo } from '../online/presets'

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
    const bvid = u.searchParams.get('bvid')
    const page = u.searchParams.get('p') || u.searchParams.get('page') || '1'
    if (!bvid) return null
    return `https://player.bilibili.com/player.html?bvid=${encodeURIComponent(bvid)}&page=${encodeURIComponent(page)}&high_quality=1&danmaku=0&autoplay=0&isOutside=true`
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
      embedUrl: `https://player.bilibili.com/player.html?bvid=${encodeURIComponent(bv)}&page=1&high_quality=1&danmaku=0&autoplay=0`,
    }
  }

  return null
}

export default function OnlineEmbedPage() {
  const [input, setInput] = useState('')
  const [presets, setPresets] = useState<PresetVideo[]>([])
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

  const normalizedInput = useMemo(() => normalizeUrl(input), [input])
  const embed = useMemo(() => buildEmbed(normalizedInput), [normalizedInput])
  const selectedSeries = useMemo(() => {
    if (series.length === 0) return null
    if (selectedBvid) return series.find((s) => s.bvid === selectedBvid) ?? series[0]
    return series[0]
  }, [series, selectedBvid])

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

  function playSeriesEpisode(bvid: string, page: number) {
    const p = Math.max(1, Math.floor(page))
    const url = `https://player.bilibili.com/player.html?isOutside=true&bvid=${encodeURIComponent(bvid)}&page=${encodeURIComponent(
      String(p),
    )}&high_quality=1&danmaku=0&autoplay=0`
    setInput(url)
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
    <main className="h-full w-full p-4 pb-[calc(env(safe-area-inset-bottom)+12px)]">
      <div className="h-full w-full grid min-h-0 gap-4 md:grid-cols-[1fr_640px]">
        <section className="min-h-0 overflow-auto">
          <div className="kid-card p-4">
            <div className="text-sm font-extrabold text-gray-900">视频乐园</div>
            <div className="mt-1 text-xs font-semibold text-gray-600">点下面的小卡片就能看（B 站/YouTube）。</div>

            <div className="mt-4 kid-card p-4">
              <div className="text-sm font-extrabold text-gray-900">视频合集</div>
              <div className="mt-1 text-xs font-semibold text-gray-600">先选一个合集，再选第几集。</div>

              <div className="sticky top-0 z-10 -mx-4 mt-3 border-y border-pink-100 bg-white/90 px-4 py-3 backdrop-blur">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-extrabold text-gray-900">
                      {selectedSeries ? selectedSeries.title : '请选择一个合集'}
                    </div>
                    <div className="mt-0.5 text-xs font-semibold text-gray-600">
                      {selectedSeries ? `${selectedSeries.pages} 集` : ''}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedSeries) return
                        const page = getEpisode(selectedSeries.bvid)
                        setEpisode(selectedSeries.bvid, page - 1, selectedSeries.pages)
                      }}
                      disabled={!selectedSeries}
                      className="kid-focus kid-btn kid-btn-soft w-12 rounded-2xl text-lg font-extrabold text-gray-800 disabled:opacity-50"
                      aria-label="上一集"
                    >
                      −
                    </button>

                    <div className="kid-card kid-pill px-4 py-2 text-sm font-extrabold text-gray-800">
                      第 {String(selectedSeries ? getEpisode(selectedSeries.bvid) : 1).padStart(3, '0')} 集
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedSeries) return
                        const page = getEpisode(selectedSeries.bvid)
                        setEpisode(selectedSeries.bvid, page + 1, selectedSeries.pages)
                      }}
                      disabled={!selectedSeries}
                      className="kid-focus kid-btn kid-btn-soft w-12 rounded-2xl text-lg font-extrabold text-gray-800 disabled:opacity-50"
                      aria-label="下一集"
                    >
                      +
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedSeries) return
                        const p = clampEpisode(getEpisode(selectedSeries.bvid), selectedSeries.pages)
                        playSeriesEpisode(selectedSeries.bvid, p)
                        setNowPlaying({ title: selectedSeries.title, bvid: selectedSeries.bvid, page: p, pages: selectedSeries.pages })
                        scrollToPlayer()
                      }}
                      disabled={!selectedSeries}
                      className="kid-focus kid-btn kid-btn-primary rounded-2xl px-6 text-sm font-extrabold text-white disabled:opacity-50"
                    >
                      播放
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-2">
                {series.map((s) => {
                  const page = getEpisode(s.bvid)
                  const padded = String(page).padStart(3, '0')
                  const selected = selectedSeries?.bvid === s.bvid
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
                        <div className="mt-0.5 text-xs font-semibold text-gray-500">{s.pages} 集</div>
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
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="mt-4 kid-card p-4">
              <div className="text-sm font-extrabold text-gray-900">小卡片</div>
              <div className="mt-1 text-xs font-semibold text-gray-600">点一下就播放。</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {presets.slice(0, 6).map((p, idx) => {
                  const disabled = !p.url.trim()
                  return (
                    <button
                      key={`${idx}:${p.title}`}
                      type="button"
                      onClick={() => {
                        if (disabled) return
                        setInput(p.url)
                        setNowPlaying(null)
                        scrollToPlayer()
                      }}
                      className={[
                        'kid-focus kid-btn w-full text-left',
                        'kid-card px-4 py-3 transition-colors',
                        disabled ? 'opacity-60' : 'hover:bg-white',
                      ].join(' ')}
                      disabled={disabled}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-extrabold text-gray-900">{p.title}</div>
                          <div className="mt-0.5 truncate text-xs font-semibold text-gray-500">
                            {disabled ? '（等待配置链接）' : '点我播放'}
                          </div>
                        </div>
                        <div className="shrink-0 text-base text-pink-500">🎬</div>
                      </div>
                    </button>
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

        <section ref={playerRef} className="min-h-0">
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
                          playSeriesEpisode(nowPlaying.bvid, prev)
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
                          playSeriesEpisode(nowPlaying.bvid, next)
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
