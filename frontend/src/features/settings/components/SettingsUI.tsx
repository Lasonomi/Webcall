import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useSettings, type LocalSettings } from '../settings.store'

type BooleanKeys = { [K in keyof LocalSettings]: LocalSettings[K] extends boolean ? K : never }[keyof LocalSettings]

export function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="space-y-5">
      <header>
        <h2 className="text-xl font-semibold">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </header>
      {children}
    </section>
  )
}

export function Card({ title, children, tone = 'default' }: { title?: string; children: ReactNode; tone?: 'default' | 'danger' }) {
  return (
    <div className={cn('rounded-xl border bg-surface px-4 py-2', tone === 'danger' ? 'border-red-500/30' : 'border-border')}>
      {title && (
        <p className={cn('pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em]', tone === 'danger' ? 'text-red-400' : 'text-gold')}>
          {title}
        </p>
      )}
      <div className="divide-y divide-border">{children}</div>
    </div>
  )
}

export function Row({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
      <div className="min-w-0 flex-1 basis-56">
        <label htmlFor={htmlFor} className="text-sm font-medium">{label}</label>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 rounded-full border transition-colors disabled:opacity-40',
        checked ? 'border-gold bg-maroon' : 'border-border bg-surface-2'
      )}
    >
      <span className={cn('absolute top-0.5 rounded-full bg-white transition-all', checked ? 'left-[22px]' : 'left-0.5')} style={{ height: 18, width: 18 }} />
    </button>
  )
}

/** Switch yang langsung terikat ke satu key boolean di settings store. */
export function SettingSwitch({ field, label, hint }: { field: BooleanKeys; label: string; hint?: string }) {
  const value = useSettings((s) => s[field])
  const set = useSettings((s) => s.set)
  return (
    <Row label={label} hint={hint}>
      <Switch checked={value} onChange={(v) => set(field, v as never)} label={label} />
    </Row>
  )
}

export function Segmented<T extends string | number>({
  value, options, onChange, label,
}: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full border border-border bg-background/40 p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-full px-3.5 py-1 text-xs font-semibold transition-colors',
            value === o.value ? 'bg-maroon/40 text-white shadow-[0_0_0_1px_rgba(212,175,55,0.3)]' : 'text-muted hover:text-foreground'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function SelectField({
  id, value, onChange, options, className,
}: { id?: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; className?: string }) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn('h-9 w-full min-w-[200px] max-w-xs rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-maroon', className)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

export function Slider({ value, onChange, label, min = 0, max = 100 }: { value: number; onChange: (v: number) => void; label: string; min?: number; max?: number }) {
  return (
    <div className="flex w-56 items-center gap-3">
      <input
        type="range" min={min} max={max} value={value} aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 flex-1 cursor-pointer accent-[var(--wc-gold)]"
      />
      <span className="w-9 text-right text-xs tabular-nums text-muted">{value}%</span>
    </div>
  )
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'error' | 'ok' }) {
  return (
    <p role="status" className={cn('rounded-lg border px-3 py-2 text-xs',
      tone === 'error' ? 'border-red-500/40 text-red-400' : tone === 'ok' ? 'border-gold/40 text-gold' : 'border-border text-muted')}>
      {children}
    </p>
  )
}

export function SoonBadge() {
  return <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted">Belum tersedia di backend</span>
}
