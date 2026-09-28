<script setup lang="ts">
import { cn } from '@/lib/utils'
const props = defineProps<{ class?: string }>()
</script>
<template>
  <div
    role="tablist"
    :class="cn('inline-flex items-center gap-1 rounded-lg bg-[var(--wc-surface-2)] p-1 text-[var(--wc-muted)]', props.class)"
  >
    <slot />
  </div>
</template>
