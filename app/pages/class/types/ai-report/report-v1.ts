export type TimelineData = {
  mainColor: string
  title: string
  /**如果沒給，會變成用 mainColor*/
  subtitleColor?: string
  subtitle: string
  aiRole?: string
  userRole?: string
  aiSay?: string
  userAudio?: {
    ref?: string
    url?: string
    startTime?: number
    audioInfo?: string
  }
  aiAudio?: {
    ref?: string
    url?: string
    startTime?: number
  }
  userSay?: string
  analysis?: string[]
  keyPoint?: {
    sentences: string[]
    problems: string[]
  }
}

export type ReportDatas = {
  timeline: TimelineData[]
  meta?: {
    keyPointTitle1?: string
    keyPointTitle2?: string
    keyPointIcon1?: string
    keyPointIcon2?: string
  }
}

export type GradingItem = {
  appendScore: number
  reason: string
  score: number
  title: string
  type: string
  typeId: number
}

export type OReportProps = {
  variant?: 'landbank' | 'common' | undefined

  reportTitle?: string
  history?: Array<{ role: string, content: string }>
  rubric?: Array<{ criterion: string, score: number, reason: string }>
  playLogText?: string
  adviceItems?: Array<{ content: string }>
  user?: {
    name?: string
    code?: string
    jobTitle?: string
  }
}