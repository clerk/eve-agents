import { Chat } from '@/components/chat/chat'

export default function ChatPage() {
  return (
    <div className="max-w-2xl mx-auto p-6 w-full h-[calc(100vh-4rem)] relative">
      <div className="flex flex-col h-full min-h-0">
        <Chat />
      </div>
    </div>
  )
}
