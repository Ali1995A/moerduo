import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { invoke } from '@tauri-apps/api/tauri'

interface PlaybackState {
  is_playing: boolean
  current_audio_id: number | null
  current_audio_name: string | null
  volume: number
  speed: number
  playlist_queue: number[]
  current_index: number
  is_auto_play: boolean
  is_scheduled: boolean
}

interface PlayerContextType {
  isPlaying: boolean
  currentAudio: {
    id: number
    name: string
  } | null
  currentIndex: number
  totalCount: number
  playAudio: (id: number, name: string, audioList?: Array<{id: number, name: string}>) => Promise<void>
  pauseAudio: () => Promise<void>
  stopAudio: () => Promise<void>
  togglePlayPause: () => Promise<void>
  playNext: () => Promise<void>
  playPrevious: () => Promise<void>
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined)

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentAudio, setCurrentAudio] = useState<{ id: number; name: string } | null>(null)
  const [audioList, setAudioList] = useState<Array<{id: number, name: string}>>([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [prevPlayingState, setPrevPlayingState] = useState(false)

  // 定期同步播放状态
  useEffect(() => {
    const syncState = async () => {
      try {
        const state = await invoke<PlaybackState>('get_playback_state')

        // 检测播放完成：之前在播放，现在停止了，且启用了自动播放
        const wasPlaying = prevPlayingState
        const nowPlaying = state.is_playing
        const playbackFinished = wasPlaying && !nowPlaying && state.is_auto_play &&
                                  state.playlist_queue.length > 0

        if (playbackFinished) {
          console.log('🎵 [PlayerContext] 检测到播放完成，自动播放下一首')
          // 播放下一首（后端会处理循环逻辑）
          try {
            await invoke('play_next')
          } catch (error) {
            console.error('自动播放下一首失败:', error)
          }
          return // 返回，等待下次同步获取最新状态
        }

        // 更新播放状态
        setPrevPlayingState(state.is_playing)

        // 只在状态真正改变时更新，避免不必要的重渲染
        if (state.is_playing !== isPlaying) {
          setIsPlaying(state.is_playing)
        }

        // 如果后端没有当前音频（播放完成或停止），清除前端状态
        if (!state.current_audio_id && currentAudio) {
          setCurrentAudio(null)
          setIsPlaying(false)
        } else if (state.current_audio_id && state.current_audio_name) {
          // 如果后端有音频但前端没有，或者ID不匹配，更新前端状态
          if (!currentAudio || currentAudio.id !== state.current_audio_id) {
            setCurrentAudio({
              id: state.current_audio_id,
              name: state.current_audio_name
            })
          }
        }

        // 同步播放队列信息
        if (state.playlist_queue.length > 0) {
          setCurrentIndex(state.current_index)
          // 如果audioList为空，从后端队列重建
          if (audioList.length === 0 && state.current_audio_id && state.current_audio_name) {
            // 注意：这里只能重建当前音频，完整列表需要从后端获取
            setAudioList([{ id: state.current_audio_id, name: state.current_audio_name }])
          }
        }
      } catch (error) {
        console.error('同步播放状态失败:', error)
      }
    }

    syncState()
    const interval = setInterval(syncState, 500) // 每0.5秒同步一次

    return () => clearInterval(interval)
  }, [isPlaying, currentAudio, prevPlayingState, audioList.length])

  const playAudio = async (id: number, name: string, newAudioList?: Array<{id: number, name: string}>) => {
    try {
      await invoke('play_audio', { id })
      setCurrentAudio({ id, name })
      setIsPlaying(true)

      // 如果提供了新的音频列表，更新列表和索引
      if (newAudioList && newAudioList.length > 0) {
        setAudioList(newAudioList)
        const index = newAudioList.findIndex(audio => audio.id === id)
        setCurrentIndex(index)
      } else {
        // 如果没有提供列表，检查当前列表中是否有这个音频
        const index = audioList.findIndex(audio => audio.id === id)
        if (index !== -1) {
          setCurrentIndex(index)
        } else {
          // 如果列表中没有，清空列表
          setAudioList([{ id, name }])
          setCurrentIndex(0)
        }
      }
    } catch (error) {
      console.error('播放失败:', error)
      throw error
    }
  }

  const pauseAudio = async () => {
    try {
      await invoke('pause_audio')
      setIsPlaying(false)
    } catch (error) {
      console.error('暂停失败:', error)
      throw error
    }
  }

  const stopAudio = async () => {
    try {
      await invoke('stop_audio')
      setIsPlaying(false)
      setCurrentAudio(null)
    } catch (error) {
      console.error('停止失败:', error)
      throw error
    }
  }

  const togglePlayPause = async () => {
    if (isPlaying) {
      await pauseAudio()
    } else {
      if (currentAudio) {
        // 如果有当前音频，恢复播放
        await invoke('play_audio', { id: currentAudio.id })
        setIsPlaying(true)
      }
    }
  }

  const playNext = async () => {
    if (audioList.length === 0 || currentIndex === -1) return

    const nextIndex = currentIndex + 1
    if (nextIndex < audioList.length) {
      const nextAudio = audioList[nextIndex]
      await playAudio(nextAudio.id, nextAudio.name)
    }
  }

  const playPrevious = async () => {
    if (audioList.length === 0 || currentIndex === -1) return

    const prevIndex = currentIndex - 1
    if (prevIndex >= 0) {
      const prevAudio = audioList[prevIndex]
      await playAudio(prevAudio.id, prevAudio.name)
    }
  }

  return (
    <PlayerContext.Provider
      value={{
        isPlaying,
        currentAudio,
        currentIndex,
        totalCount: audioList.length,
        playAudio,
        pauseAudio,
        stopAudio,
        togglePlayPause,
        playNext,
        playPrevious,
      }}
    >
      {children}
    </PlayerContext.Provider>
  )
}

export function usePlayer() {
  const context = useContext(PlayerContext)
  if (context === undefined) {
    throw new Error('usePlayer must be used within a PlayerProvider')
  }
  return context
}
