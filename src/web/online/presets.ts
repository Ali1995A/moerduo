export type PresetVideo = {
  title: string
  url: string
}

const fallback: PresetVideo[] = [
  { title: '小朋友最爱的视频 1（待配置）', url: '' },
  { title: '小朋友最爱的视频 2（待配置）', url: '' },
  { title: '小朋友最爱的视频 3（待配置）', url: '' },
  { title: '小朋友最爱的视频 4（待配置）', url: '' },
  { title: '小朋友最爱的视频 5（待配置）', url: '' },
  { title: '小朋友最爱的视频 6（待配置）', url: '' },
]

export async function loadPresetVideos(): Promise<PresetVideo[]> {
  try {
    const res = await fetch('/presets/bilibili.json', { cache: 'no-cache' })
    if (!res.ok) return fallback
    const json = (await res.json()) as unknown
    if (!Array.isArray(json)) return fallback
    const list = json
      .map((v) => {
        if (!v || typeof v !== 'object') return null
        const title = (v as any).title
        const url = (v as any).url
        if (typeof title !== 'string' || typeof url !== 'string') return null
        return { title, url } satisfies PresetVideo
      })
      .filter(Boolean) as PresetVideo[]
    return list.length > 0 ? list : fallback
  } catch {
    return fallback
  }
}

