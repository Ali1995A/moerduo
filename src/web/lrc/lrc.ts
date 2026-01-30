export type LrcLine = {
  time: number
  text: string
}

const timeTag = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g

export function parseLrc(raw: string): LrcLine[] {
  const lines: LrcLine[] = []
  for (const line of raw.split(/\r?\n/)) {
    timeTag.lastIndex = 0
    const tags: number[] = []
    let match: RegExpExecArray | null
    while ((match = timeTag.exec(line))) {
      const mm = Number(match[1])
      const ss = Number(match[2])
      const ms = match[3] ? Number(match[3].padEnd(3, '0')) : 0
      const time = mm * 60 + ss + ms / 1000
      if (Number.isFinite(time)) tags.push(time)
    }
    const text = line.replace(timeTag, '').trim()
    for (const t of tags) {
      lines.push({ time: t, text })
    }
  }
  return lines.sort((a, b) => a.time - b.time)
}

export function findActiveLineIndex(lines: LrcLine[], currentTime: number): number {
  if (lines.length === 0) return -1
  let lo = 0
  let hi = lines.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (lines[mid].time <= currentTime) lo = mid + 1
    else hi = mid - 1
  }
  return Math.max(0, lo - 1)
}

