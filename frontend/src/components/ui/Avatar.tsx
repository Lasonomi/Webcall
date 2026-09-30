import { cn, initials } from '@/lib/utils'

export function Avatar({
  name,
  src,
  size = 'md',
  className,
  onClick,
}: {
  name?: string
  src?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
  onClick?: (e?: React.MouseEvent) => void
}) {
  const dim =
    size === 'sm' ? 'h-8 w-8 text-[10px]' : size === 'lg' ? 'h-12 w-12 text-sm' : 'h-9 w-9 text-xs'
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-full overflow-hidden bg-maroon/80 flex items-center justify-center font-semibold text-white shrink-0',
        dim,
        onClick && 'cursor-pointer',
        className
      )}
    >
      {src ? <img src={src} alt={name} className="h-full w-full object-cover" /> : initials(name)}
    </div>
  )
}
