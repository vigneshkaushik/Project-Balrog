export function FloatingNavbar() {
  return (
    <nav className="pointer-events-auto absolute left-4 right-4 top-4 z-20">
      <div className="flex h-12 w-full items-center rounded-xl border border-neutral-200 bg-white/80 px-4 shadow-sm backdrop-blur-md">
        <span className="text-sm font-semibold tracking-wide text-neutral-900">
          Balrog
        </span>
      </div>
    </nav>
  )
}
