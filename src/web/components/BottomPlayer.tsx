import { useMemo } from 'react'
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { useWebPlayerStore } from '../player/playerStore'

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function BottomPlayer() {
  const {
    queue,
    currentIndex,
    isPlaying,
    playbackRate,
    currentTime,
    duration,
    lastError,
    toggle,
    next,
    prev,
    seek,
    setPlaybackRate,
    clearError,
  } = useWebPlayerStore()

  const track = queue[currentIndex] ?? null
  const progress = useMemo(() => {
    if (!duration) return 0
    return Math.max(0, Math.min(1, currentTime / duration))
  }, [currentTime, duration])

  const disabled = !track

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="mx-auto max-w-5xl px-4 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-gray-900">{track ? `${track.lessonLabel} · ${track.title}` : '未选择课程'}</div>
            <div className="mt-0.5 flex items-center justify-between text-xs text-gray-500">
              <span className="truncate">{track ? `NCE${track.book}` : '请选择一课开始播放'}</span>
              <span>
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void prev()}
              disabled={disabled || currentIndex <= 0}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 text-gray-800 disabled:opacity-40"
              aria-label="上一首"
            >
              <SkipBack size={20} />
            </button>
            <button
              type="button"
              onClick={() => void toggle()}
              disabled={disabled}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white disabled:opacity-40"
              aria-label={isPlaying ? '暂停' : '播放'}
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <button
              type="button"
              onClick={() => void next()}
              disabled={disabled || currentIndex >= queue.length - 1}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 text-gray-800 disabled:opacity-40"
              aria-label="下一首"
            >
              <SkipForward size={20} />
            </button>
          </div>
        </div>

        <div className="pb-3">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={duration ? currentTime : 0}
            onChange={(e) => seek(Number(e.target.value))}
            disabled={!duration}
            className="h-2 w-full accent-blue-600"
            aria-label="播放进度"
          />

          <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <span>倍速</span>
              <select
                value={playbackRate}
                onChange={(e) => setPlaybackRate(Number(e.target.value))}
                className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs"
              >
                {[0.75, 1, 1.25, 1.5].map((r) => (
                  <option key={r} value={r}>
                    {r}x
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden sm:block">{progress ? `${Math.round(progress * 100)}%` : ''}</div>
              {lastError ? (
                <button
                  type="button"
                  onClick={clearError}
                  className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700"
                >
                  {lastError}（点此关闭）
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

