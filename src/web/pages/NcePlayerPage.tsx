import { useEffect, useMemo, useRef, useState } from 'react'
import BottomPlayer from '../components/BottomPlayer'
import { fetchNceLessons } from '../nce/nceApi'
import type { NceBook, NceLesson } from '../nce/nceTypes'
import { useWebPlayerStore } from '../player/playerStore'
import type { Track } from '../player/playerTypes'
import { findActiveLineIndex, parseLrc, type LrcLine } from '../lrc/lrc'

type Props = {
  initialTab?: 'lessons' | 'queue'
}

function toTrack(lesson: NceLesson): Track {
  return {
    id: `${lesson.book}:${lesson.filename}`,
    book: lesson.book,
    title: lesson.title,
    lessonLabel: lesson.lessonLabel,
    filename: lesson.filename,
    mp3Url: lesson.mp3Url,
    lrcUrl: lesson.lrcUrl,
  }
}

async function fetchLrcText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: 'force-cache' })
    if (!res.ok) return null
    const text = await res.text()
    return text.trim() ? text : null
  } catch {
    return null
  }
}

export default function NcePlayerPage({ initialTab = 'lessons' }: Props) {
  const [book, setBook] = useState<NceBook>(1)
  const [tab, setTab] = useState<'lessons' | 'queue'>(initialTab)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [lessons, setLessons] = useState<NceLesson[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const { queue, currentIndex, currentTime, setQueueAndPlay, playIndex } = useWebPlayerStore()
  const currentTrack = queue[currentIndex] ?? null

  const [lrcLines, setLrcLines] = useState<LrcLine[]>([])
  const [lrcMissing, setLrcMissing] = useState(false)
  const lyricsRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let canceled = false
    setLoading(true)
    setLoadError(null)
    fetchNceLessons(book)
      .then((data) => {
        if (canceled) return
        setLessons(data)
      })
      .catch((err) => {
        if (canceled) return
        setLoadError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (canceled) return
        setLoading(false)
      })
    return () => {
      canceled = true
    }
  }, [book])

  useEffect(() => {
    let canceled = false
    setLrcLines([])
    setLrcMissing(false)

    if (!currentTrack) return
    fetchLrcText(currentTrack.lrcUrl).then((text) => {
      if (canceled) return
      if (!text) {
        setLrcMissing(true)
        return
      }
      const parsed = parseLrc(text)
      setLrcLines(parsed)
      setLrcMissing(parsed.length === 0)
    })

    return () => {
      canceled = true
    }
  }, [currentTrack?.id, currentTrack?.lrcUrl])

  const filteredLessons = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return lessons
    return lessons.filter((l) => {
      const hay = `${l.lessonLabel} ${l.title} ${l.filename}`.toLowerCase()
      return hay.includes(q)
    })
  }, [lessons, search])

  const activeLineIndex = useMemo(() => findActiveLineIndex(lrcLines, currentTime), [lrcLines, currentTime])

  useEffect(() => {
    const container = lyricsRef.current
    if (!container) return
    if (activeLineIndex < 0) return

    const el = container.querySelector<HTMLElement>(`[data-line-index="${activeLineIndex}"]`)
    if (!el) return

    const top = el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2
    container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
  }, [activeLineIndex])

  const hasQueue = queue.length > 0

  const pageBottomPad = 'pb-[calc(env(safe-area-inset-bottom)+120px)]'

  return (
    <main className={`mx-auto max-w-5xl px-4 py-5 ${pageBottomPad}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {([1, 2, 3, 4] as const).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => {
                setBook(b)
                setTab('lessons')
              }}
              className={[
                'h-10 rounded-xl px-3 text-sm font-semibold transition-colors',
                book === b ? 'bg-blue-600 text-white' : 'border border-gray-200 bg-white text-gray-800 hover:bg-gray-50',
              ].join(' ')}
            >
              NCE{b}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('lessons')}
            className={[
              'h-10 rounded-xl px-3 text-sm font-semibold',
              tab === 'lessons' ? 'bg-blue-50 text-blue-700' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200',
            ].join(' ')}
          >
            课程
          </button>
          <button
            type="button"
            onClick={() => setTab('queue')}
            className={[
              'h-10 rounded-xl px-3 text-sm font-semibold',
              tab === 'queue' ? 'bg-blue-50 text-blue-700' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200',
            ].join(' ')}
          >
            队列{hasQueue ? ` (${queue.length})` : ''}
          </button>
        </div>
      </div>

      <div className="mt-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索 Lesson 或标题"
          className="h-11 w-full rounded-2xl border border-gray-200 bg-white px-4 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[420px_1fr]">
        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div className="text-sm font-semibold text-gray-900">{tab === 'lessons' ? `NCE${book} 课程` : '当前播放队列'}</div>
            <div className="text-xs text-gray-500">{tab === 'lessons' ? `${filteredLessons.length} 条` : `${queue.length} 条`}</div>
          </div>

          <div className="max-h-[60dvh] overflow-auto px-2 py-2 md:max-h-[calc(100dvh-260px)]">
            {tab === 'lessons' ? (
              loading ? (
                <div className="p-4 text-sm text-gray-500">加载中…</div>
              ) : loadError ? (
                <div className="p-4 text-sm text-red-600">{loadError}</div>
              ) : filteredLessons.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">没有匹配的课程</div>
              ) : (
                <ul className="space-y-1">
                  {filteredLessons.map((lesson) => {
                    const trackId = `${lesson.book}:${lesson.filename}`
                    const active = currentTrack?.id === trackId
                    return (
                      <li key={trackId}>
                        <button
                          type="button"
                          onClick={() => {
                            const viewQueue = filteredLessons.map(toTrack)
                            const idx = viewQueue.findIndex((t) => t.id === trackId)
                            void setQueueAndPlay(viewQueue, Math.max(0, idx))
                            setTab('queue')
                          }}
                          className={[
                            'w-full rounded-xl px-3 py-3 text-left transition-colors',
                            active ? 'bg-blue-50' : 'hover:bg-gray-50',
                          ].join(' ')}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-gray-900">{lesson.lessonLabel}</div>
                              <div className="mt-0.5 truncate text-xs text-gray-600">{lesson.title}</div>
                            </div>
                            <div className="shrink-0 text-xs text-gray-400">▶</div>
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )
            ) : !hasQueue ? (
              <div className="p-4 text-sm text-gray-500">从课程列表点一课开始播放，会自动生成队列。</div>
            ) : (
              <ul className="space-y-1">
                {queue.map((t, idx) => {
                  const active = idx === currentIndex
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => void playIndex(idx)}
                        className={[
                          'w-full rounded-xl px-3 py-3 text-left transition-colors',
                          active ? 'bg-blue-50' : 'hover:bg-gray-50',
                        ].join(' ')}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-gray-900">{t.lessonLabel}</div>
                            <div className="mt-0.5 truncate text-xs text-gray-600">{t.title}</div>
                          </div>
                          <div className="shrink-0 text-xs text-gray-400">{active ? '正在播放' : '播放'}</div>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-3">
            <div className="text-sm font-semibold text-gray-900">歌词</div>
            <div className="mt-1 text-xs text-gray-500">{currentTrack ? `${currentTrack.lessonLabel} · ${currentTrack.title}` : '选择一课开始播放'}</div>
          </div>

          <div ref={lyricsRef} className="max-h-[60dvh] overflow-auto px-4 py-4 md:max-h-[calc(100dvh-260px)]">
            {!currentTrack ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
                从左侧课程列表点一课开始播放。
              </div>
            ) : lrcMissing ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
                暂无歌词（LRC）。
              </div>
            ) : lrcLines.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">加载歌词中…</div>
            ) : (
              <div className="space-y-2">
                {lrcLines.map((line, idx) => {
                  const active = idx === activeLineIndex
                  return (
                    <div
                      key={`${line.time}:${idx}`}
                      data-line-index={idx}
                      className={[
                        'rounded-xl px-3 py-2 text-sm transition-colors',
                        active ? 'bg-blue-50 text-blue-800' : 'text-gray-700',
                      ].join(' ')}
                    >
                      {line.text || '…'}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      <BottomPlayer />
    </main>
  )
}

