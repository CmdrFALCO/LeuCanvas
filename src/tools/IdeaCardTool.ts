import { BaseBoxShapeTool } from 'tldraw'

export class IdeaCardTool extends BaseBoxShapeTool {
  static override id = 'idea-card'
  static override initial = 'idle'
  override shapeType = 'idea-card'
}
