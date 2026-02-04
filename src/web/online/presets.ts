export type PresetVideo = {
  title: string
  url: string
  group?: string
}

export type PresetSeriesItem = {
  title: string
  url: string
}

export type PresetSeries = {
  id: string
  title: string
  pages: number
  kind: 'bilibili' | 'custom'
  bvid?: string
  aid?: number
  cids?: number[]
  items?: PresetSeriesItem[]
}

const fallback: PresetVideo[] = []

const fallbackSeries: PresetSeries[] = [
  { id: 'BV1WG39zPETL', title: '新概念英语视频合集', kind: 'bilibili', bvid: 'BV1WG39zPETL', pages: 138 },
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
        const pages = (v as any).pages

        if (typeof title !== 'string') return null

        const rawBvid = (v as any).bvid
        const rawItems = (v as any).items
        const rawId = (v as any).id

        // Custom series: { id, title, items: [{title,url}, ...] }
        if (Array.isArray(rawItems)) {
          const items = rawItems
            .map((it: any) => {
              if (!it || typeof it !== 'object') return null
              const itTitle = it.title
              const itUrl = it.url
              if (typeof itTitle !== 'string' || typeof itUrl !== 'string') return null
              return { title: itTitle, url: itUrl } satisfies PresetSeriesItem
            })
            .filter(Boolean) as PresetSeriesItem[]

          if (items.length <= 0) return null
          const parsedPages =
            typeof pages === 'number' && Number.isFinite(pages) && pages > 0 ? Math.floor(pages) : items.length
          const id =
            typeof rawId === 'string' && rawId.trim()
              ? rawId.trim()
              : typeof title === 'string'
                ? title.trim() || `custom-${items.length}`
                : `custom-${items.length}`

          return {
            id,
            title,
            kind: 'custom',
            pages: parsedPages,
            items,
          } satisfies PresetSeries
        }

        // Bilibili series: { title, bvid, pages, aid?, cids? }
        if (typeof rawBvid !== 'string' || typeof pages !== 'number') return null
        if (!Number.isFinite(pages) || pages <= 0) return null
        const aid = (v as any).aid
        const cids = (v as any).cids
        const parsedAid = typeof aid === 'number' && Number.isFinite(aid) ? Math.floor(aid) : undefined
        const parsedCids = Array.isArray(cids)
          ? cids
              .map((n) => (typeof n === 'number' ? n : Number(n)))
              .filter((n) => Number.isFinite(n) && n > 0)
              .map((n) => Math.floor(n))
          : undefined

        return {
          id: rawBvid,
          title,
          kind: 'bilibili',
          bvid: rawBvid,
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
