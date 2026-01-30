import { create } from 'zustand'
import type { Track } from './playerTypes'

type PlayerState = {
  queue: Track[]
  currentIndex: number
  isPlaying: boolean
  playbackRate: number
  currentTime: number
  duration: number
  lastError: string | null
}

type PlayerActions = {
  setQueueAndPlay: (queue: Track[], index: number) => Promise<void>
  playIndex: (index: number) => Promise<void>
  toggle: () => Promise<void>
  pause: () => Promise<void>
  next: () => Promise<void>
  prev: () => Promise<void>
  seek: (timeSeconds: number) => void
  setPlaybackRate: (rate: number) => void
  clearError: () => void
}

const audio = new Audio()
audio.preload = 'metadata'
audio.crossOrigin = 'anonymous'

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return '播放失败'
}

function updateMediaSession(track: Track | null) {
  if (!('mediaSession' in navigator)) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ms = (navigator as any).mediaSession as MediaSession | undefined
  if (!ms) return

  if (!track) {
    ms.metadata = null
    return
  }

  ms.metadata = new MediaMetadata({
    title: `${track.lessonLabel} · ${track.title}`,
    artist: `NCE${track.book}`,
    album: '新概念英语',
  })
}

export const useWebPlayerStore = create<PlayerState & PlayerActions>((set, get) => ({
  queue: [],
  currentIndex: -1,
  isPlaying: false,
  playbackRate: 1,
  currentTime: 0,
  duration: 0,
  lastError: null,

  clearError: () => set({ lastError: null }),

  setQueueAndPlay: async (queue, index) => {
    set({ queue, currentIndex: index, lastError: null })
    await get().playIndex(index)
  },

  playIndex: async (index) => {
    const state = get()
    const nextIndex = clamp(index, 0, Math.max(0, state.queue.length - 1))
    const track = state.queue[nextIndex]
    if (!track) return

    try {
      audio.pause()
      audio.src = track.mp3Url
      audio.currentTime = 0
      audio.playbackRate = state.playbackRate
      updateMediaSession(track)

      set({ currentIndex: nextIndex, lastError: null })
      await audio.play()
    } catch (err) {
      set({ isPlaying: false, lastError: formatError(err) })
    }
  },

  toggle: async () => {
    const state = get()
    if (state.isPlaying) return get().pause()
    if (state.currentIndex >= 0) return get().playIndex(state.currentIndex)
    if (state.queue.length > 0) return get().playIndex(0)
  },

  pause: async () => {
    audio.pause()
  },

  next: async () => {
    const state = get()
    if (state.queue.length === 0) return
    const nextIndex = clamp(state.currentIndex + 1, 0, state.queue.length - 1)
    await get().playIndex(nextIndex)
  },

  prev: async () => {
    const state = get()
    if (state.queue.length === 0) return
    const prevIndex = clamp(state.currentIndex - 1, 0, state.queue.length - 1)
    await get().playIndex(prevIndex)
  },

  seek: (timeSeconds) => {
    audio.currentTime = clamp(timeSeconds, 0, Number.isFinite(audio.duration) ? audio.duration : timeSeconds)
  },

  setPlaybackRate: (rate) => {
    const normalized = clamp(rate, 0.5, 2)
    audio.playbackRate = normalized
    set({ playbackRate: normalized })
  },
}))

audio.addEventListener('play', () => {
  useWebPlayerStore.setState({ isPlaying: true, lastError: null })
})
audio.addEventListener('pause', () => {
  useWebPlayerStore.setState({ isPlaying: false })
})
audio.addEventListener('timeupdate', () => {
  useWebPlayerStore.setState({
    currentTime: audio.currentTime || 0,
    duration: Number.isFinite(audio.duration) ? audio.duration : 0,
  })
})
audio.addEventListener('ended', () => {
  const { currentIndex, queue } = useWebPlayerStore.getState()
  const nextIndex = currentIndex + 1
  if (nextIndex < queue.length) {
    void useWebPlayerStore.getState().playIndex(nextIndex)
  } else {
    updateMediaSession(null)
  }
})

if ('mediaSession' in navigator) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ms = (navigator as any).mediaSession as MediaSession | undefined
  if (ms) {
    ms.setActionHandler('play', () => void useWebPlayerStore.getState().toggle())
    ms.setActionHandler('pause', () => void useWebPlayerStore.getState().pause())
    ms.setActionHandler('previoustrack', () => void useWebPlayerStore.getState().prev())
    ms.setActionHandler('nexttrack', () => void useWebPlayerStore.getState().next())
    ms.setActionHandler('seekto', (details) => {
      if (details.seekTime != null) useWebPlayerStore.getState().seek(details.seekTime)
    })
  }
}

