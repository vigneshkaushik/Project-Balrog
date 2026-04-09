function tryParseJsonArray(content: string): unknown[] | null {
  const t = content.trim()
  if (!t.startsWith('[')) return null
  try {
    const v = JSON.parse(t) as unknown
    return Array.isArray(v) ? v : null
  } catch {
    return null
  }
}

function isSearchHit(
  x: unknown,
): x is { text?: unknown; url?: unknown; topic?: unknown } {
  return typeof x === 'object' && x !== null
}

function linkHostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'Open link'
  }
}

function ToolResultError({ content }: { content: string }) {
  return (
    <details className="mt-1" open>
      <summary className="cursor-pointer text-[0.7rem] font-medium text-red-800 hover:underline">
        Error details
      </summary>
      <pre className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[0.7rem] leading-relaxed text-red-900">
        {content}
      </pre>
    </details>
  )
}

export function ToolResultView({
  content,
  isError,
}: {
  content: string
  isError: boolean
}) {
  if (isError) {
    return <ToolResultError content={content} />
  }

  const arr = tryParseJsonArray(content)
  const hits = arr?.filter(isSearchHit) ?? []
  const looksLikeDdg =
    hits.length > 0 &&
    hits.some(
      (h) =>
        typeof h.text === 'string' ||
        (typeof h.url === 'string' && h.url.length > 0),
    )

  if (looksLikeDdg) {
    return (
      <div className="mt-1 space-y-2">
        <details open className="rounded-md border border-emerald-200/70 bg-white/60">
          <summary className="cursor-pointer select-none px-2 py-1.5 text-[0.7rem] font-semibold text-emerald-900 hover:bg-emerald-50/80">
            Search hits ({hits.length})
            <span className="ml-1 font-normal text-emerald-700/80">
              — collapse or expand
            </span>
          </summary>
          <ul className="max-h-56 space-y-2 overflow-y-auto border-t border-emerald-200/50 px-2 py-2">
            {hits.slice(0, 25).map((h) => {
              const text = typeof h.text === 'string' ? h.text : ''
              const url = typeof h.url === 'string' ? h.url : ''
              const topic = h.topic != null ? String(h.topic) : ''
              const rowKey = `${url}|${topic}|${text.slice(0, 40)}`
              return (
                <li
                  key={rowKey}
                  className="rounded-md border border-emerald-100 bg-emerald-50/40 px-2 py-2"
                >
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[0.7rem] font-semibold text-primary hover:underline"
                    >
                      {linkHostLabel(url)}
                    </a>
                  ) : null}
                  {text ? (
                    <p
                      className={`whitespace-pre-wrap text-[0.75rem] leading-relaxed text-neutral-800 ${url ? 'mt-1' : ''}`}
                    >
                      {text}
                    </p>
                  ) : !url ? (
                    <span className="text-[0.7rem] text-neutral-500">
                      (no text)
                    </span>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </details>
        <details className="rounded-md border border-neutral-200/80 bg-neutral-50/80">
          <summary className="cursor-pointer px-2 py-1.5 text-[0.65rem] font-medium text-neutral-600 hover:bg-neutral-100/80">
            Raw JSON
          </summary>
          <pre className="max-h-36 overflow-auto border-t border-neutral-200/60 p-2 font-mono text-[0.65rem] leading-snug text-neutral-800">
            {content}
          </pre>
        </details>
      </div>
    )
  }

  return (
    <details className="mt-1 rounded-md border border-emerald-200/60 bg-white/50" open>
      <summary className="cursor-pointer px-2 py-1.5 text-[0.7rem] font-semibold text-emerald-900 hover:bg-emerald-50/60">
        Tool output
        <span className="ml-1 font-normal text-emerald-800/80">
          ({content.length} chars)
        </span>
      </summary>
      <pre className="max-h-44 overflow-y-auto whitespace-pre-wrap break-words border-t border-emerald-200/50 p-2 font-mono text-[0.7rem] leading-relaxed text-emerald-950">
        {content}
      </pre>
    </details>
  )
}
