import { useEffect, useMemo, useState } from 'react'
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
  const [selectedSeriesIndex, setSelectedSeriesIndex] = useState(0)
  const [selectedEpisode, setSelectedEpisode] = useState(1)

  useEffect(() => {
    let canceled = false
    loadPresetVideos().then((v) => {
      if (canceled) return
      setPresets(v)
    })
    loadPresetSeries().then((s) => {
      if (canceled) return
      setSeries(s)
      setSelectedSeriesIndex(0)
      setSelectedEpisode(1)
    })
    return () => {
      canceled = true
    }
  }, [])

  const normalizedInput = useMemo(() => normalizeUrl(input), [input])
  const embed = useMemo(() => buildEmbed(normalizedInput), [normalizedInput])

  const activeSeries = series[selectedSeriesIndex] ?? null
  const episodeOptions = useMemo(() => {
    if (!activeSeries) return []
    const count = Math.max(1, Math.min(500, activeSeries.pages))
    return Array.from({ length: count }, (_, i) => i + 1)
  }, [activeSeries])

  function playSeriesEpisode(bvid: string, page: number) {
    const p = Math.max(1, Math.floor(page))
    const url = `https://player.bilibili.com/player.html?isOutside=true&bvid=${encodeURIComponent(bvid)}&page=${encodeURIComponent(
      String(p),
    )}&high_quality=1&danmaku=0&autoplay=0`
    setInput(url)
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 pb-[calc(env(safe-area-inset-bottom)+120px)]">
      <div className="kid-card p-4">
        <div className="text-sm font-extrabold text-gray-900">视频乐园</div>
        <div className="mt-1 text-xs font-semibold text-gray-600">点下面的小卡片就能看（B 站/YouTube）。</div>

        <div className="mt-4 kid-card p-4">
          <div className="text-sm font-extrabold text-gray-900">视频合集</div>
          <div className="mt-1 text-xs font-semibold text-gray-600">选一集，然后点“开始播放”。</div>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <label className="text-xs font-extrabold text-gray-700">
              合集
              <select
                value={selectedSeriesIndex}
                onChange={(e) => {
                  const idx = Number(e.target.value)
                  setSelectedSeriesIndex(Number.isFinite(idx) ? idx : 0)
                  setSelectedEpisode(1)
                }}
                className="kid-focus mt-1 h-12 w-full rounded-3xl border border-pink-100 bg-white/80 px-4 text-sm font-extrabold"
              >
                {series.map((s, idx) => (
                  <option key={`${s.bvid}:${idx}`} value={idx}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-extrabold text-gray-700">
              第几集
              <select
                value={selectedEpisode}
                onChange={(e) => setSelectedEpisode(Number(e.target.value))}
                className="kid-focus mt-1 h-12 w-full rounded-3xl border border-pink-100 bg-white/80 px-4 text-sm font-extrabold"
                disabled={!activeSeries}
              >
                {episodeOptions.map((n) => (
                  <option key={n} value={n}>
                    第 {String(n).padStart(3, '0')} 集
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  if (!activeSeries) return
                  playSeriesEpisode(activeSeries.bvid, selectedEpisode)
                }}
                disabled={!activeSeries}
                className="kid-focus kid-btn kid-btn-primary w-full rounded-3xl px-5 text-sm font-extrabold text-white disabled:opacity-50"
              >
                开始播放
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {presets.slice(0, 6).map((p, idx) => {
            const disabled = !p.url.trim()
            return (
              <button
                key={`${idx}:${p.title}`}
                type="button"
                onClick={() => {
                  if (disabled) return
                  setInput(p.url)
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
                    <div className="mt-0.5 truncate text-xs font-semibold text-gray-500">{disabled ? '（等待配置链接）' : '点我播放'}</div>
                  </div>
                  <div className="shrink-0 text-base text-pink-500">🎬</div>
                </div>
              </button>
            )
          })}
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="也可以粘贴一个链接（B站/YouTube）"
            className="kid-focus h-12 w-full rounded-3xl border border-pink-100 bg-white/80 px-4 text-sm font-semibold outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-pink-100"
            inputMode="url"
          />
          <button
            type="button"
            onClick={() => setInput('')}
            className="kid-focus kid-btn kid-btn-soft rounded-3xl px-5 text-sm font-extrabold text-gray-700 hover:bg-white"
          >
            清空
          </button>
        </div>

        <div className="mt-4">
          {!input.trim() ? (
            <div className="rounded-2xl border border-dashed border-pink-100 bg-white/60 p-6 text-sm font-semibold text-gray-600">
              先点上面的小卡片，或者粘贴链接～
            </div>
          ) : !embed ? (
            <div className="rounded-2xl border border-dashed border-pink-100 bg-white/60 p-6 text-sm font-semibold text-gray-600">
              这个链接我不认识～请确认是 YouTube 或 Bilibili 的分享链接。
            </div>
          ) : (
            <div className="aspect-video overflow-hidden rounded-2xl border border-pink-100 bg-black">
              <iframe
                src={embed.embedUrl}
                title="Online Player"
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                referrerPolicy="no-referrer"
              />
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
