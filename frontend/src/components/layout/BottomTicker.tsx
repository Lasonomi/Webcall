export function BottomTicker({ items = [] }: { items?: string[] }) {
  const text =
    items.length > 0
      ? items.join('   ·   ')
      : 'WebCall — notifications appear here while you chat.'
  return (
    <div className="flex h-8 items-center overflow-hidden border-t border-border bg-surface px-4">
      <div className="animate-marquee flex whitespace-nowrap text-xs text-muted">
        <span className="pr-16">{text}</span>
        <span className="pr-16">{text}</span>
      </div>
    </div>
  )
}
