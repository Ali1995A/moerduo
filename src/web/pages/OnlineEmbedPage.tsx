import { useEffect, useMemo, useState } from 'react'
import { loadPresetVideos, type PresetVideo } from '../online/presets'

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

function buildEmbed(url: string): { provider: 'youtube' | 'bilibili'; embedUrl: string } | null {
  const yt = getYouTubeId(url)
  if (yt) {
    return {
      provider: 'youtube',
      embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(yt)}?autoplay=0&playsinline=1`,
    }
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

  useEffect(() => {
    let canceled = false
    loadPresetVideos().then((v) => {
      if (canceled) return
      setPresets(v)
    })
    return () => {
      canceled = true
    }
  }, [])

  const embed = useMemo(() => buildEmbed(input.trim()), [input])

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 pb-[calc(env(safe-area-inset-bottom)+120px)]">
      <div className="kid-card p-4">
        <div className="text-sm font-extrabold text-gray-900">视频乐园</div>
        <div className="mt-1 text-xs font-semibold text-gray-600">点下面的小卡片就能看（B 站/YouTube）。</div>

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
