import { Chat } from '@/components/chat/chat'

export default function ChatPage() {
  return (
    <div className="min-h-0 flex-1 p-6">
      <div className="relative mx-auto flex h-full min-h-0 w-full max-w-2xl flex-col">
        <Chat />
      </div>
    </div>
  )
}
