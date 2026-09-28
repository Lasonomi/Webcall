<script setup lang="ts">
import { computed } from 'vue'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-[var(--wc-maroon)] text-white',
        secondary: 'border-transparent bg-[var(--wc-surface-2)] text-[var(--wc-muted)]',
        gold: 'border-transparent bg-[color-mix(in_srgb,var(--wc-gold)_20%,transparent)] text-[var(--wc-gold)]',
        outline: 'border-[var(--wc-border)] text-[var(--wc-muted)]',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)
type BadgeVariants = VariantProps<typeof badgeVariants>
const props = defineProps<{ variant?: BadgeVariants['variant']; class?: string }>()
const classes = computed(() => cn(badgeVariants({ variant: props.variant }), props.class))
</script>
<template><span :class="classes"><slot /></span></template>
