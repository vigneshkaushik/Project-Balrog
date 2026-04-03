import { Outlet } from 'react-router-dom'
import { ChatSidebar } from './ChatSidebar'

export function AppLayout() {
  return (
    <div className="flex h-svh min-h-0 w-full flex-col bg-neutral-100 md:flex-row">
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto md:basis-[60%]">
        <Outlet />
      </main>
      <div className="flex min-h-0 w-full shrink-0 flex-col md:h-svh md:max-w-[380px] md:basis-[40%]">
        <ChatSidebar />
      </div>
    </div>
  )
}
