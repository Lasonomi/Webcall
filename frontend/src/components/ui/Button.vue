<script setup lang="ts">
import { computed } from 'vue'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wc-maroon)] disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
  {
    variants: {
      variant: {
        default: 'bg-[var(--wc-maroon)] text-white hover:bg-[var(--wc-maroon-dark)]',
        secondary: 'bg-[var(--wc-surface-2)] text-[var(--wc-fg)] border border-[var(--wc-border)] hover:opacity-90',
        outline: 'border border-[var(--wc-border)] bg-transparent text-[var(--wc-fg)] hover:bg-[var(--wc-surface-2)]',
        ghost: 'text-[var(--wc-muted)] hover:bg-[var(--wc-surface-2)] hover:text-[var(--wc-fg)]',
        gold: 'bg-[var(--wc-gold)] text-[#0a0a0a] hover:opacity-90 font-semibold',
        destructive: 'bg-[#b91c1c] text-white hover:opacity-90',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-11 rounded-lg px-6',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
)

type ButtonVariants = VariantProps<typeof buttonVariants>
const props = withDefaults(
  defineProps<{
    variant?: ButtonVariants['variant']
    size?: ButtonVariants['size']
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
    class?: string
  }>(),
  { type: 'button', disabled: false }
)
const classes = computed(() =>
  cn(buttonVariants({ variant: props.variant, size: props.size }), props.class)
)
</script>
<template>
  <button :type="type" :disabled="disabled" :class="classes"><slot /></button>
</template>
