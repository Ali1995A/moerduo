import { useMemo, useState } from 'react'

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
      embedUrl: `https://player.bilibili.com/player.html?bvid=${encodeURIComponent(bv)}&page=1&high_quality=1&danmaku=0`,
    }
  }

  return null
}

export default function OnlineEmbedPage() {
  const [input, setInput] = useState('')
  const embed = useMemo(() => buildEmbed(input.trim()), [input])

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-gray-900">在线视频（嵌入播放）</div>
        <div className="mt-1 text-xs text-gray-500">支持 YouTube / Bilibili。复制链接粘贴即可播放。</div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="粘贴 YouTube/B站 视频链接"
            className="h-11 w-full rounded-xl border border-gray-300 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            inputMode="url"
          />
          <button
            type="button"
            onClick={() => setInput('')}
            className="h-11 rounded-xl border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            清空
          </button>
        </div>

        <div className="mt-4">
          {!input.trim() ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
              粘贴链接后将自动识别并生成播放器。
            </div>
          ) : !embed ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
              未识别的链接。请确认是 YouTube 或 Bilibili 的分享链接。
            </div>
          ) : (
            <div className="aspect-video overflow-hidden rounded-xl border border-gray-200 bg-black">
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

