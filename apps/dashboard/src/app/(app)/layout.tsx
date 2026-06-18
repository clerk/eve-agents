import { AppSidebar } from '@/components/app-sidebar'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider className="min-h-0 flex-1">
      <AppSidebar />
      <SidebarInset className="min-h-0 dark:shadow-md dark:shadow-black">
        <div className="flex h-10 items-center gap-2 border-b px-3">
          <SidebarTrigger className="-ml-1" />
        </div>
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
