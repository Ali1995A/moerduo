import type { NceBook, NceDataJson, NceLesson } from './nceTypes'

function getNceBaseUrl(): string {
  return (import.meta.env.VITE_NCE_BASE_URL as string | undefined)?.replace(/\/+$/, '') || 'https://www.linktime.link'
}

function parseFilenamePrefix(filename: string): string {
  const dashIndex = filename.indexOf('－')
  if (dashIndex === -1) return filename
  return filename.slice(0, dashIndex).trim()
}

function toLessonLabel(prefix: string): string {
  const normalized = prefix.replace(/^0+/, '')
  if (normalized.includes('&')) {
    const parts = normalized
      .split('&')
      .map((p) => p.replace(/^0+/, '').trim())
      .filter(Boolean)
    if (parts.length === 2) return `Lesson ${parts[0]}&${parts[1]}`
    if (parts.length > 2) return `Lesson ${parts.join('&')}`
  }
  return `Lesson ${normalized}`
}

export async function fetchNceLessons(book: NceBook): Promise<NceLesson[]> {
  const baseUrl = getNceBaseUrl()
  const res = await fetch(`${baseUrl}/static/data.json`, { cache: 'force-cache' })
  if (!res.ok) throw new Error(`Failed to load NCE data.json: ${res.status}`)
  const json = (await res.json()) as NceDataJson

  const entries = json[String(book)] ?? []
  return entries.map((entry) => {
    const prefix = parseFilenamePrefix(entry.filename)
    const lessonLabel = toLessonLabel(prefix)

    const filename = entry.filename
    const mp3Url = `${baseUrl}/NCE${book}/${encodeURIComponent(filename)}.mp3`
    const lrcUrl = `${baseUrl}/NCE${book}/${encodeURIComponent(filename)}.lrc`

    return {
      book,
      title: entry.title,
      filename,
      lessonLabel,
      mp3Url,
      lrcUrl,
    }
  })
}

