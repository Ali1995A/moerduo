import type { NceBook } from '../nce/nceTypes'

export type Track = {
  id: string
  book: NceBook
  title: string
  lessonLabel: string
  filename: string
  mp3Url: string
  lrcUrl: string
}

