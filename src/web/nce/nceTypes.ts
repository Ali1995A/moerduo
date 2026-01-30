export type NceBook = 1 | 2 | 3 | 4

export type NceDataEntry = {
  title: string
  filename: string
  oddTitle?: string
  evenTitle?: string
  oddContent?: string
  evenContent?: string
}

export type NceDataJson = Record<string, NceDataEntry[]>

export type NceLesson = {
  book: NceBook
  title: string
  filename: string
  lessonLabel: string
  mp3Url: string
  lrcUrl: string
}

