<script setup lang="ts">
import { cn } from '@/lib/utils'
const props = withDefaults(
  defineProps<{ variant?: 'default' | 'destructive' | 'gold'; class?: string }>(),
  { variant: 'default' }
)
</script>
<template>
  <div
    role="alert"
    :class="cn(
      'relative w-full rounded-lg border px-4 py-3 text-sm',
      variant === 'destructive' && 'border-red-500/40 bg-red-500/10 text-red-200',
      variant === 'gold' && 'border-[var(--wc-gold)]/30 bg-[var(--wc-gold)]/10 text-[var(--wc-gold)]',
      variant === 'default' && 'border-[var(--wc-border)] bg-[var(--wc-surface-2)] text-[var(--wc-fg)]',
      props.class
    )"
  >
    <slot />
  </div>
</template>
