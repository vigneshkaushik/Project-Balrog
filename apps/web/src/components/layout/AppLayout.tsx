import { Outlet } from 'react-router-dom'
import { FloatingChat } from './FloatingChat'
import { FloatingNavbar } from './FloatingNavbar'

export function AppLayout() {
  return (
    <div className="relative h-svh min-h-0 w-full overflow-hidden bg-neutral-100">
      <main className="flex h-full min-h-0 min-w-0 w-full flex-col overflow-hidden">
        <Outlet />
      </main>
      <div className="pointer-events-none absolute inset-0 z-20">
        <FloatingNavbar />
        <FloatingChat />
      </div>
    </div>
  )
}
