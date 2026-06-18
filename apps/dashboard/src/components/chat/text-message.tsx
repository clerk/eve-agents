import { MessageResponse } from '@/components/ai-elements/message'

export function TextMessage({ text }: { text: string }) {
  return <MessageResponse>{text}</MessageResponse>
}
