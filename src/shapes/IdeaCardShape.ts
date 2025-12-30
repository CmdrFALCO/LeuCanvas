import { T } from 'tldraw'
import type { TLBaseShape } from 'tldraw'

// Shape properties for IdeaCard
export interface IdeaCardProps {
  title: string
  content: string
  w: number
  h: number
}

// The IdeaCard shape type
export type IdeaCardShape = TLBaseShape<'idea-card', IdeaCardProps>

// Shape property migrations (for future versioning)
export const ideaCardShapeProps = {
  title: T.string,
  content: T.string,
  w: T.number,
  h: T.number,
}
