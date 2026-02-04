export type PresetVideo = {
  title: string
  url: string
  group?: string
}

export type PresetSeries = {
  title: string
  bvid: string
  pages: number
  aid?: number
  cids?: number[]
}

const fallback: PresetVideo[] = [
  { title: '小朋友最爱的视频 1（待配置）', url: '' },
  { title: '小朋友最爱的视频 2（待配置）', url: '' },
  { title: '小朋友最爱的视频 3（待配置）', url: '' },
  { title: '小朋友最爱的视频 4（待配置）', url: '' },
  { title: '小朋友最爱的视频 5（待配置）', url: '' },
  { title: '小朋友最爱的视频 6（待配置）', url: '' },
]

const fallbackSeries: PresetSeries[] = [{ title: '新概念英语视频合集', bvid: 'BV1WG39zPETL', pages: 138 }]

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
        const group = (v as any).group
        if (typeof title !== 'string' || typeof url !== 'string') return null
        return {
          title,
          url,
          group: typeof group === 'string' && group.trim() ? group.trim() : undefined,
        } satisfies PresetVideo
      })
      .filter(Boolean) as PresetVideo[]
    return list.length > 0 ? list : fallback
  } catch {
    return fallback
  }
}

export async function loadPresetSeries(): Promise<PresetSeries[]> {
  try {
    const res = await fetch('/presets/bilibili-series.json', { cache: 'no-cache' })
    if (!res.ok) return fallbackSeries
    const json = (await res.json()) as unknown
    if (!Array.isArray(json)) return fallbackSeries
    const list = json
      .map((v) => {
        if (!v || typeof v !== 'object') return null
        const title = (v as any).title
        const bvid = (v as any).bvid
        const pages = (v as any).pages
        const aid = (v as any).aid
        const cids = (v as any).cids
        if (typeof title !== 'string' || typeof bvid !== 'string' || typeof pages !== 'number') return null
        if (!Number.isFinite(pages) || pages <= 0) return null
        const parsedAid = typeof aid === 'number' && Number.isFinite(aid) ? Math.floor(aid) : undefined
        const parsedCids = Array.isArray(cids)
          ? cids
              .map((n) => (typeof n === 'number' ? n : Number(n)))
              .filter((n) => Number.isFinite(n) && n > 0)
              .map((n) => Math.floor(n))
          : undefined
        return {
          title,
          bvid,
          pages: Math.floor(pages),
          aid: parsedAid,
          cids: parsedCids && parsedCids.length > 0 ? parsedCids : undefined,
        } satisfies PresetSeries
      })
      .filter(Boolean) as PresetSeries[]
    return list.length > 0 ? list : fallbackSeries
  } catch {
    return fallbackSeries
  }
}
