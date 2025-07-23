
export type MetaItem = {
  title?: string
  subtitle?: string
  timelineColor?: string
  subtitleColor?: string
}

export type TimelineItem = {
  meta?: MetaItem
  node: React.ReactNode
}

export type TimelineContainerProps = {
  items: TimelineItem[]
  className?: string
}