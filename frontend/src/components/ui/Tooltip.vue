<script setup lang="ts">
import { ref } from 'vue'
import { cn } from '@/lib/utils'
defineProps<{ text: string; side?: 'top' | 'bottom' }>()
const show = ref(false)
</script>
<template>
  <span class="relative inline-flex" @mouseenter="show=true" @mouseleave="show=false" @focusin="show=true" @focusout="show=false">
    <slot />
    <span
      v-if="show && text"
      role="tooltip"
      :class="cn('pointer-events-none absolute z-50 whitespace-nowrap rounded-md border border-[var(--wc-border)] bg-[var(--wc-surface)] px-2 py-1 text-xs text-[var(--wc-fg)] shadow-md', side==='bottom' ? 'left-1/2 top-full mt-1.5 -translate-x-1/2' : 'bottom-full left-1/2 mb-1.5 -translate-x-1/2')"
    >{{ text }}</span>
  </span>
</template>
