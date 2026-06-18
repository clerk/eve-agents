import type { ToolUIPart } from 'ai'
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
  type ToolPart,
} from '@/components/ai-elements/tool'

export function ToolMessage({ part }: { part: ToolPart }) {
  return (
    <Tool>
      {part.type === 'dynamic-tool' ? (
        <ToolHeader
          type="dynamic-tool"
          state={part.state}
          toolName={part.toolName}
        />
      ) : (
        <ToolHeader
          type={part.type as ToolUIPart['type']}
          state={part.state}
        />
      )}
      <ToolContent>
        <ToolInput input={part.input} />
        <ToolOutput output={part.output} errorText={part.errorText} />
      </ToolContent>
    </Tool>
  )
}
